# Проверка всех 8 протоколов на локальных симуляторах

Дата прогона: 4 ноября 2026, ветка `main` (`afd7513`).
Окружение: Windows, Python 3.12.10, `requests` 2.34.2, `websockets` 17.3,
`paho-mqtt` 2.x.

```
python scripts/test-all-protocols.py
```

Итог: **8 из 8 протоколов, 339 проверок, 0 провалов.** Код выхода `0`.

## Метод

Настоящие принтеры не нужны: каждый протокол проверяется своим тестом
(`scripts/test-<протокол>.py`), который поднимает симулятор принтера на loopback
и гоняет по нему **настоящий адаптер агента** из `agent/adapters/` — тем же
кодом, который работает на ферме.

- HTTP/WebSocket-эндпоинты поднимает `http.server` и `websockets.sync.server`;
- MQTT-брокер Anycubic — `socketserver` на порту 9883 (как у прошивки);
- UDP-обнаружение FlashForge и Elegoo — сокеты на боевых портах
  (8899/19000/48899, 3000);
- выключенный принтер изображает адрес `*.invalid` (RFC 2606): DNS не отдаёт
  адрес, и адаптер обязан вернуть `False`, а не исключение.

Сводный прогон (`scripts/test-all-protocols.py`) запускает тесты по очереди
(порты 9999 / 3030 / 9883 фиксированные), разбирает строки `✓`/`✗`, раскладывает
их по операциям контракта адаптера (`connect`, `upload_file`, `start_print`,
`get_status`) и печатает таблицу. Провал любого протокола — код выхода `1`.

## Сводная таблица

| Протокол | Транспорт | Подключение | Загрузка | Старт | Состояние | Прочее | Всего | Вердикт |
|---|---|---|---|---|---|---|---|---|
| Moonraker (Klipper) | HTTP 7125 | 5/5 | 5/5 | 3/3 | 7/7 | 3/3 | 23 | **OK** |
| OctoPrint | HTTP (80) | 3/3 | 4/4 | 3/3 | 7/7 | 5/5 | 22 | **OK** |
| PrusaLink | HTTP (80) | 3/3 | 7/7 | 2/2 | 8/8 | 9/9 | 29 | **OK** |
| Creality (K1/K2) | HTTP + WS 9999 | 3/3 | 4/4 | 4/4 | 2/2 | 16/16 | 29 | **OK** |
| Elegoo (SDCP) | HTTP + WS 3030 | 7/7 | 5/5 | 2/2 | 2/2 | 20/20 | 36 | **OK** |
| Anycubic (Kobra) | MQTT 9883 + HTTP | 3/3 | 2/2 | 6/6 | 2/2 | 31/31 | 44 | **OK** |
| Bambu Lab | MQTT 8883 + FTPS 990 | 10/10 | 9/9 | 12/12 | 2/2 | 58/58 | 91 | **OK** |
| FlashForge | HTTP 8898 + UDP | 15/15 | 8/8 | 2/2 | 3/3 | 37/37 | 65 | **OK** |
| **Итого** | | **49** | **44** | **34** | **33** | **179** | **339** | **0 провалов** |

«Прочее» — проверки вне четырёх операций: отказы выключенного принтера, отказы
прошивки (401/404/409/415/507, `Ack ≠ 0`, `code: 1`), фабрика и реестр
протоколов, сканер обнаружения, разбор паспорта принтера.

## Что проверено по протоколам

### Moonraker (Klipper) — `scripts/test-moonraker.py`

Симулятор: `http.server` на loopback, ключ проверяется как на принтере
(чужой `X-Api-Key` → 401).

- `connect()` → `GET /server/info` с `X-Api-Key`; `klippy_state = error` не
  мешает подключению (файл залить можно), 401 даёт причину в `last_error`;
- `upload_file()` → `POST /server/files/upload`, поле `file`, `root=gcodes`;
  успех 201 и 200; 507 объясняется текстом Moonraker; `.3mf` отклоняется до сети;
- `start_print()` → `POST /printer/print/start?filename=<имя>`; 404 «файла нет» —
  отказ, а не успех;
- `get_status()` → `GET /printer/objects/query?print_stats&virtual_sdcard`:
  доля 0…1 пересчитывается в проценты, остаток — по `print_duration`; `paused`,
  незнакомое состояние, пустой `status` и HTTP 500 дают `error`;
- `stop_print()` → `POST /printer/print/cancel`;
- **полный цикл задания**: `connect → upload → start → printing → complete →
  idle` на одном подключении.

### OctoPrint — `scripts/test-octoprint.py`

- `GET /api/version` с `X-Api-Key`; чужой ключ (401) — отказ с причиной;
- `POST /api/files/local` multipart: поле `file`, `select=true`, `print=false`,
  имя с пробелом приходит как `my-job.gcode`; 415 объясняется;
- `select` + `print` по имени файла; `Printing`, `Paused`, `Operational`,
  `Offline` переводятся в статусы агента (прогресс из `job.progress.completion`,
  остаток из `printTimeLeft`);
- пауза, возврат и отмена уходят в `POST /api/job`, 409 не выдаётся за успех.

### PrusaLink — `scripts/test-prusa.py`

- `GET /api/v1/status` с `X-Api-Key`; 401 — отказ с причиной;
- `PUT /api/v1/files/<storage>/<name>` с `Content-Type: application/octet-stream`,
  `Print-After-Upload: ?0` и `Overwrite: ?1`; хранилище из `printer_secrets`
  (по умолчанию `usb`), незнакомое значение не уходит в путь; 415/409 объясняются;
- `start_print()` → `{"command": "print"}` по имени файла;
- `get_status()` собирает ответ из `/api/v1/status` и `/api/v1/job`; `BUSY` —
  печать, `PAUSED` — пауза, `STOPPED`/`ATTENTION` — отказ; 204 на пустое
  задание — нули, а не ошибка; пауза/возврат/остановка — `POST /api/v1/job`.

### Creality (K1/K2) — `scripts/test-creality.py`

Симулятор: HTTP на loopback + `websockets.sync.server` на 9999.

- `GET /info` (модель `F008` → K2 Plus) и подтверждение `heart_beat` по
  WebSocket; молчание на `heart_beat` — отказ (на 9999 бывает чужое приложение);
- `POST /upload/<имя>` multipart, имя с пробелом приходит с `_`;
  `{"code": 1}` в теле — отказ; `.3mf` отклоняется до сети;
- `start_print()` → `opGcodeFile` с `printprt:/usr/data/`, на отказе пробует
  `/mnt/UDISK/` и запоминает рабочую папку;
- `get_status()` переводит `state`, читает проценты и остаток;
  пауза/возврат/остановка — `pause: 1|0` и `stop: 1`;
- сканер проверяет 9999 раньше 7125 (K2 Plus открывает оба порта).

### Elegoo (SDCP) — `scripts/test-elegoo.py`

Симулятор: `websockets.sync.server` на 3030 + HTTP на loopback + UDP 3000.

- `connect()` → `ws://<ip>:3030/websocket`, `Cmd: 0` в конверте SDCP
  (`sdcp/request/0`), `MainboardID` берётся из ответа принтера (номер из секретов
  не главнее);
- `POST /uploadFile/upload` multipart с `S-File-MD5`, `Check`, `Offset`, `Uuid`,
  `TotalSize`; MD5 совпадает с суммой файла; `{"success": false}` объясняется;
- `start_print()` → `Cmd: 128` с `Filename`, `StartLayer: 0`,
  `path_prefix: /local`; пауза/остановка/возврат — `Cmd: 129/130/131`;
  `Ack ≠ 0` и молчание принтера — отказ;
- `get_status()` читает `Status`, `Progress` и разность тиков, понимает
  `Attributes` строкой и дополняет кэш частичными отчётами;
- сканер находит принтер по UDP `M99999` и берёт `MainboardID`.

### Anycubic (Kobra) — `scripts/test-anycubic.py`

Симулятор: MQTT-брокер на 9883 + HTTP-служба загрузки на loopback.

- `connect()` поднимает MQTT, спрашивает паспорт `info/query`, берёт из
  `info/report` `modeId`, `deviceId` и `urls.fileUploadurl`; брокер без паспорта —
  отказ («на порту отвечает не Anycubic»);
- `upload_file()` шлёт `POST` на адрес из паспорта с полем `gcode` (не `file`) и
  заголовком `X-File-Length`; отказы `19007` и `10105` объясняются;
- `start_print()` → `print/start` с `taskid: -1`, `filename`, `md5`
  (совпадает с файлом), `filetype: 1`, `filesize`, `project_type: 1`;
  отказ `10105` и молчание принтера — `False`, а не «команда отправлена»;
- пауза/возврат/остановка — `pause`/`resume`/`stop` с номером задачи;
- `get_status()` читает `state`, `progress`, `printLeftTime` из частичных
  отчётов, дополняя кэш.

### Bambu Lab — `scripts/test-bambu.py`

Симулятор: подменённые MQTT-клиент и FTPS (проверяется контракт адаптера, а не
TLS-канал: у прошивки он с самоподписанным сертификатом).

- серийник обязателен: без него `connect()` и `start_print()` отказывают одной
  фразой и в сеть не ходят; шаблонная подписка `device/+/report` не создаётся;
- `get_status()` — `gcode_state`, `mc_percent`, остаток в секундах (у Bambu он в
  минутах), частичные отчёты дополняют кэш; `FAILED`/`CANCELLED` → `error` с
  причиной из `fail_reason`/`print_error`;
- проект `.3mf` из Bambu Studio уходит на карту как есть, адаптер помнит запись
  пластины (`Metadata/plate_N.gcode`); плоский `.gcode` и STL отклоняются до сети;
- `start_print()` → `project_file`, печать считается запущенной только по ответу
  принтера; обрыв MQTT во время загрузки не убивает печать (`_publish()`
  переподключается и повторяет команду один раз).

### FlashForge — `scripts/test-flashforge.py`

Симулятор: HTTP на loopback + UDP-ответчик на 8899/19000/48899.

- `POST /detail` с `serialNumber` и `checkCode`; ранняя сборка (404 на POST)
  находится запасным `GET` с заголовками; плоский паспорт 5.x (`status`,
  `printProgress`, `pid`) тоже читается; чужой JSON принтером не считается;
- `POST /uploadGcode` multipart с полем `gcodeFile` и заголовками `fileSize`,
  `printNow: false`, `levelingBeforePrint: true`; `.3mf` без G-code отклоняется;
- `start_print()` → `POST /printGcode` c `serialNumber`, `checkCode`, `fileName`;
- пауза/возврат/остановка — `/control` (`pause`, `continue`, `cancel`);
- `get_status()` переводит `machineStatus`, читает проценты и остаток;
- сканер находит принтер по UDP `~M115` и достаёт `SN` текстом, JSON или из
  сырой строки с мусором.

## Ограничения

- **Bambu Lab.** MQTT-клиент и FTPS в тесте подменены: у прошивки TLS с
  самоподписанным сертификатом, а проверяется контракт адаптера (топики,
  команды, разбор отчётов, отказы). Реальный TLS-канал до принтера не поднимался.
- **Anycubic.** Брокер в тесте без TLS (`MQTT_TLS = False`): подделать
  рукопожатие нельзя, а конверт сообщений и разбор отчётов проверяются полностью.
  На боевом принтере адаптер идёт на 9883 с `CERT_NONE`.
- Настоящие принтеры в прогоне не участвуют — проверено соответствие адаптеров
  контракту протоколов на симуляторах. Отличия прошивок, которых нет в
  симуляторах (недокументированные отказы, таймауты Wi-Fi), ловятся только на
  живой ферме.

## Как повторить

```
python scripts/test-all-protocols.py              # все 8 протоколов, сводная таблица
python scripts/test-all-protocols.py moonraker    # один протокол
python scripts/test-moonraker.py                  # подробный вывод одного теста
```

Порты 9999 (Creality), 3030 (Elegoo), 9883 (Anycubic) и UDP-порты обнаружения
должны быть свободны: занятый порт — повод разобраться, что ещё живёт в сети, а
не пропустить проверку.
