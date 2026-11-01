# Локальный агент 3D-фермы

Python-скрипт, который работает на компьютере мастера и разбирает очередь печати
Мастерской: спрашивает у приложения задания (`GET /api/agent/tasks`), сообщает их
статус (`POST /api/agent/status`) и раз в 30 секунд отмечает принтеры живыми
(`POST /api/agent/heartbeat`). Сервер и его контракт описаны в
`app/api/agent/tasks/route.ts`, `app/api/agent/status/route.ts` и
`app/api/agent/heartbeat/route.ts`, проверка токена — в `lib/agent-auth.ts`.

Секреты протокола приходят в задании полем `secrets` (это
`workshop_printers.printer_secrets`: `checkCode` FlashForge, логин-пароль и
`deviceId`/`modeId` Anycubic, `mainboardId` Elegoo, `storage` PrusaLink), а
кнопку «Проверить связь» из формы принтера обслуживает пара `GET`/`POST
/api/agent/probe`: сервер не видит локальную сеть мастера, поэтому принтер
проверяет агент и он же возвращает модель, SN и возможности. Контракт —
`app/api/agent/probe/route.ts`.

Текущее состояние — **шаг 7**. Шаг 4.1 — каркас и цикл опроса: агент читает
`.env`, раз в `POLL_INTERVAL` секунд запрашивает очередь и пишет в журнал, сколько
задач пришло. Шаг 4.2 — интерфейс и фабрика адаптеров. Шаг 4.3 — `MoonrakerAdapter`
с реальными HTTP-запросами: проверка связи, загрузка G-code, старт печати и
состояние. Шаг 4.4 — обработка заданий целиком: `process_task()` скачивает G-code
в `agent/temp/`, ведёт его через адаптер и мониторит печать. Шаг 6.1 — пульс:
каждые 30 секунд `POST /api/agent/heartbeat` отмечает `last_seen_at` у принтеров
мастерской, а сетевые ошибки не останавливают агента. Шаг 7.2 — обнаружение
фермы: `scanner.py` обходит локальную сеть, находит Creality (WebSocket 9999 и
`GET /info`), Moonraker (7125), Anycubic (9883) и OctoPrint (80/443) и отправляет
находки в `POST /api/agent/discover`, а мастер даёт им имена в интерфейсе. Адаптер Bambu
(MQTT и FTPS, шаг 7.5) уже печатает, OctoPrint — с шага 8.3. Шаг 8.1 — реестр
протоколов: `adapters/registry.py` знает восемь протоколов (moonraker,
octoprint, bambu, prusa, creality, anycubic, flashforge, elegoo) вместе с
портами, форматами файлов и секретами. Шаг 6 — `AnycubicAdapter`: MQTT на 9883
для паспорта, команд и отчётов, HTTP-загрузка на адрес из паспорта; проверка без
принтера — `scripts/test-anycubic.py`.
Шаг 8.2 — форматы: `adapters/formats.py` сверяет расширение со справочником,
приводит имя файла к ASCII и пакует `.gcode` в `.3mf`, а `prepare_upload()` в
базовом классе отдаёт адаптеру готовый `UploadPlan` с чистым именем и размером.
Шаг 8.3 — дешёвые адаптеры: `OctoPrintAdapter` и `PrusaAdapter` (PrusaLink)
разговаривают с принтером по-настоящему — подключение, загрузка файла, старт
печати, пауза, возврат, отмена и опрос состояния; ответы API в тестах имитирует
`http.server` на loopback (`scripts/test-octoprint.py`, `scripts/test-prusa.py`).
Шаг 4 — `CrealityAdapter`: HTTP для паспорта и файла, WebSocket 9999 для команд;
фейковый принтер в `scripts/test-creality.py` поднимает оба канала. Шаг 5 —
`FlashForgeAdapter` (HTTP 8898 с `serialNumber` и `checkCode` в заголовках) и
`ElegooAdapter` (SDCP: WebSocket 3030 для команд, HTTP для файла); в тестах
`scripts/test-flashforge.py` и `scripts/test-elegoo.py` принтеры поднимаются
фейковыми HTTP, WebSocket и UDP-сокетами, а оба протокола находятся бродкастом.

Задания печатаются параллельно: одно задание — один поток (`start_job()`), поэтому
ферма из десяти принтеров не ждёт окончания первой печати. Повторно пришедшая
задача (статус ещё `queued`) и второй G-code на занятый принтер отсекаются
реестром `_active_jobs` / `_active_printers`.

## Требования

- Python 3.8 или новее (`python --version`).
- Заполненные настройки мастерской в приложении: токен агента (`agent_token`)
  выдаётся таблицей `workshop_settings` (миграция `supabase/workshop_farm_and_shop.sql`).

## Установка зависимостей

Из папки `agent/`:

```bash
pip install -r requirements.txt
```

Зависимости: `requests` (HTTP), `python-dotenv` (чтение `.env`), `paho-mqtt`
(MQTT-клиент адаптера Bambu), `websockets` (понадобится адаптерам принтеров,
сейчас только объявлена).

## Настройка `.env`

Скопируйте шаблон и заполните значения:

```bash
copy .env.example .env      # Windows
cp .env.example .env        # Linux / macOS
```

| Переменная | Обязательна | Назначение |
|---|---|---|
| `CRM_URL` | да | Адрес приложения без слэша в конце: локально `http://localhost:3000`, на сервере — боевой домен |
| `AGENT_TOKEN` | да | Токен из настроек мастерской (uuid). Секрет: уходит только в заголовке `Authorization: Bearer …` |
| `POLL_INTERVAL` | нет | Пауза между опросами в секундах, по умолчанию 5 |
| `SCAN_NETWORK` | нет | Обход локальной сети при старте (шаг 7.2): `true`, `1`, `yes`, `on`. По умолчанию выключено |
| `SCAN_SUBNETS` | нет | Подсети для обхода через запятую (`192.168.1.0/24`). Без маски читается как `/24` |

`.env` лежит рядом с `main.py` и не попадает в git (в корневом `.gitignore` есть
`.env*`, шаблон `.env.example` — исключение). Токен не выводится в журнал: при
ошибке печатается только его длина.

## Запуск

```bash
python main.py
```

Остановка — `Ctrl+C`. Пример журнала:

```
2026-10-28 12:00:00 | INFO    | Агент запущен: http://localhost:3000, интервал опроса 5 с
2026-10-28 12:00:00 | INFO    | Пульс отправлен: принтеры мастерской отмечены живыми
2026-10-28 12:00:05 | INFO    | Получено 2 задач
2026-10-28 12:00:05 | INFO    |   задание 6f1c… | заказ: Ваза 15 см | Принтер №1
2026-10-28 12:00:05 | INFO    | Задание 6f1c…: печать в отдельном потоке, в работе 1
2026-10-28 12:00:05 | INFO    | Задание 7a2b…: печать в отдельном потоке, в работе 2
2026-10-28 12:00:10 | WARNING | Сетевая ошибка, переподключение... Очередь не запрошена: HTTPConnectionPool… Max retries exceeded
```

Агент не вылетает при сетевых ошибках: обрыв и таймаут пишутся в журнал строкой
«Сетевая ошибка, переподключение...», пульс повторяется через `RECONNECT_DELAY`
(5 секунд), а цикл опроса ждёт следующий интервал. Ответы `401` (токен не принят),
`503` (нет таблиц — не применена миграция) и таймауты (`REQUEST_TIMEOUT = 10`
секунд) тоже не останавливают процесс.

## Пульс мастерской (шаг 6.1)

Пульс — это `POST /api/agent/heartbeat` без обязательного тела (при старте —
`{"resetErrors": true}`). Сервер по токену находит мастерскую и обновляет
`last_seen_at` у всех её принтеров; вкладка «Принтеры» показывает «Офлайн», если
агент молчит дольше двух минут (`PRINTER_OFFLINE_AFTER_MS`). Это отдельный
эндпоинт, а не `status: "heartbeat"` в `/api/agent/status`: пульс не связан с
заданием и не должен требовать `jobId`.

- Пульс идёт отдельным потоком (`heartbeat_loop()`), поэтому не зависит от очереди:
  печать идёт часами в рабочих потоках, и главный цикл её не ждёт.
- Интервал — `HEARTBEAT_INTERVAL` (30 секунд), вдвое чаще порога «Офлайн»: один
  пропущенный запрос не красит живую ферму.
- Сеть упала — поток не выходит: строка «Сетевая ошибка, переподключение...» и
  повтор через `RECONNECT_DELAY` (5 секунд). Отказ сервера (`401`, `503`) ждёт
  обычный интервал: частый повтор ничего не исправит.
- При старте агент отправляет пульс с `resetErrors: true`: принтеры, оставшиеся в
  `error` после прошлого сбоя (упал агент, пропала сеть), возвращаются в `idle` с
  прогрессом 0. Дальше сброс не повторяется, иначе настоящая ошибка печати
  стиралась бы каждые полминуты.
- `Ctrl+C` не ждёт пульса: поток демон и просыпается по `threading.Event`.

## Обнаружение фермы (шаг 7.2)

`SCAN_NETWORK=true` — при старте агент обходит локальную сеть и отправляет
находки в `POST /api/agent/discover` (Bearer-токен, как у остальных запросов).
Сервер складывает их в `workshop_discovered_printers`; мастер даёт принтерам
имена в интерфейсе мастерской, и они переезжают в парк (`approveDiscoveredPrinters`).

- **Подсеть.** `SCAN_SUBNETS`, если задан (цех в другом VLAN или несколько
  сетей). Иначе — адрес своего интерфейса с маской `/24`: адрес берётся у
  UDP-сокета к `8.8.8.8` (пакет не отправляется, `connect()` только выбирает
  маршрут), а если маршрута нет — из имени машины. Совсем без адреса остаются
  стандартные `192.168.1.0/24` и `192.168.0.0/24`.
- **Порты.** `7125` — Moonraker: ответ `/server/info` должен быть 200 и содержать
  `result` с `klippy_state` или `moonraker_version`. `80`/`443` — OctoPrint:
  `/api/version` с полями `api`/`server`, а если API закрыт — название на главной
  странице. Одного открытого веб-порта мало: он открыт у роутера и телевизора.
  `9999` — Creality (порт WebSocket), `9883` — Anycubic (MQTT): здесь открытого
  порта достаточно, потому что паспорт Anycubic лежит внутри брокера и без логина
  не спросить, а находку всё равно проверяет `connect()` — на `info/query`
  отвечает только принтер.
- **Потоки.** `ThreadPoolExecutor` на 64 потока, таймаут порта 0.3 с, HTTP — 2 с:
  подсеть `/24` обходится за считанные секунды. Больше 1024 адресов за проход не
  проверяется — это уже ошибка в `SCAN_SUBNETS`.
- **HTTPS без проверки сертификата.** У принтеров он самоподписанный; проба
  читает только публичные страницы и ничего не отправляет.
- **Один проход на запуск.** Сам по себе обход в цикле опроса не повторяется:
  обход нагружает сеть, а новые принтеры не появляются каждые пять секунд.
  Повторный обход запускает только просьба мастера (ниже). Пустой список тоже
  отправляется, чтобы сервер очистил устаревшие находки.
- **Bambu — по SSDP.** M-SEARCH на `239.255.255.250:1990` с типом
  `urn:bambulab-com:device:3dprinter:1`: принтер отвечает HTTP-ответом поверх UDP,
  в `Location` — адрес, в `USN` — серийный номер. Ответ без `USN` пропускается
  (тип устройства спрашивали конкретный, но отвечать в подсети может и чужое
  железо), окно ожидания — 4 с, повторы адреса схлопываются в пользу SSDP.
  Найденный номер уходит в CRM вместе с адресом и после подтверждения
  переезжает в парк (`serial_number`), поэтому мастер не вбивает SN вручную.
  Код доступа SSDP не отдаёт — его вводят в интерфейсе мастерской: в окне
  мастера подключения при подтверждении находки (поле «Код доступа» рядом с
  именем) или позже в карточке принтера.
- **FlashForge и Elegoo — по UDP-бродкасту.** Один сокет шлёт `~M115` на 8899,
  19000 и 48899 (порт зависит от модели FlashForge) и `M99999` на 3000 (Elegoo),
  затем 3 с собирает ответы. Ответ FlashForge — текст G-code со строкой `SN:`,
  Elegoo — конверт SDCP с `MainboardID`; номер уходит в CRM как `serial_number`.
  Запрос уходит на глобальный `255.255.255.255` и на бродкаст каждой подсети:
  часть роутеров глобальный фильтрует. Ответ без номера пропускается: находка
  без него бесполезна — адаптеру нечем адресовать запросы. ICMP «порт закрыт» от
  незанятого порта поиск не отменяет: у принтера обычно открыт один порт из
  четырёх, и находка не должна от этого зависеть.
- **Журнал UDP.** Строки с префиксом `[UDP]`: запуск поиска с адресами и
  портами, каждый ответ (адрес отправителя и первые 100 символов), ошибка сети
  и пустой итог. Это парная диагностика к `[SSDP]`: по ней видно, дошёл ли
  запрос до принтера и что он ответил.
- **Журнал SSDP.** Каждый шаг пишется строкой с префиксом `[SSDP]`: запуск
  поиска, создание сокета и отправка M-SEARCH, каждый пришедший ответ (адрес
  отправителя и первые 100 символов — в них видны `USN` и `Location`), текст
  ошибки сети (`[SSDP] Ошибка сети: …`) и пустой итог (`[SSDP] Поиск завершен,
  ответов нет`). Это первое, что смотрят при «Найдено принтеров: 0»: строка о
  сокете показывает, что UDP работает и запрос ушёл, ответы — что принтер
  услышал запрос, а отсутствие строки об ответах означает, что до агента ничего
  не дошло (multicast режет Wi-Fi или файрвол).

Установка зависимостей не меняется: сканер на стандартной библиотеке, `requests`
нужен только для отправки находок.

## Сканирование по кнопке из интерфейса (шаг 7.3)

Кнопка «Найти принтеры в сети» в мастерской не может обойти локальную сеть:
её видит только агент, который стоит рядом с принтерами. Поэтому браузер не
сканирует сам, а просит агента:

1. Server Action `requestNetworkScan()` ставит `workshop_settings.scan_requested =
   true` для своей мастерской (строку настроек создаёт upsert — калькулятор мог
   ещё не сохраняться);
2. агент на каждом опросе спрашивает флаг: `GET /api/agent/scan-status` с
   Bearer-токеном, ответ `{"scan_requested": true}`;
3. если флаг поднят — `scan_network()`, затем находки в `POST
   /api/agent/discover`, и только после принятого списка сброс флага: `POST
   /api/agent/scan-complete`.

- **Сброс — отдельным запросом.** Пропала сеть или сервер ответил `503` — флаг
  остаётся, и просьба мастера не теряется.
- **Повтор не чаще `SCAN_RETRY_DELAY` (60 секунд).** Обход подсети на каждых пяти
  секундах опроса — нагрузка без пользы; `_requested_scan_at` помнит последнюю
  попытку.
- **Ошибка чтения флага пишется один раз.** Пока мастер не применит
  `supabase/workshop_farm_and_shop.sql`, `GET /api/agent/scan-status` отвечает
  `503` с подсказкой; журнал не повторяет эту строку каждые пять секунд.
- **`SCAN_NETWORK` не нужен.** Флаг в `.env` остался для обхода при старте; кнопка
  работает независимо от него.


| Функция | Назначение |
|---|---|
| `setup_logging()` | журнал в консоль: дата, время, уровень, сообщение |
| `load_settings()` | читает `.env` в `Settings`, проверяет `CRM_URL` и формат uuid у токена |
| `fetch_tasks()` | `GET /api/agent/tasks`, возвращает список заданий (пустой — «печатать нечего») |
| `log_network_error(action, error)` | сетевая ошибка в журнал: «Сетевая ошибка, переподключение...» вместо падения |
| `send_status(job_id, status, progress=None)` | `POST /api/agent/status`; `True`, если сервер записал статус |
| `send_heartbeat(reset_errors=False)` | `POST /api/agent/heartbeat`; `ok`, `network` или `rejected` |
| `heartbeat_loop(stop_event)` | пульс раз в `HEARTBEAT_INTERVAL` (30 с) в отдельном потоке; сеть — повтор через 5 с |
| `poll_once()` | один опрос: задачи и строка `Получено N задач` |
| `printer_key(task)` | ключ принтера задания (`printerId` → `id` принтера → адрес): по нему одно задание на станок |
| `start_job(task)` | запускает задание в отдельном потоке; `False` — задание уже в работе или принтер занят |
| `stop_jobs(timeout)` | ждёт активные печати при остановке, но не дольше `SHUTDOWN_JOIN_TIMEOUT` (30 с); поток — демон, часами процесс не держит |
| `active_job_count()` | сколько заданий в работе сейчас (для строки журнала) |
| `process_task(task)` | задание целиком: скачать G-code → адаптер → загрузка → печать → мониторинг |
| `download_gcode(url, path)` | `requests.get(..., stream=True)` в `agent/temp/`, запись кусками по 64 КБ |
| `monitor_print(job_id, adapter)` | опрос `get_status()` до `done`/`failed`: первая пауза `PRINT_START_DELAY` (60 с — принтер разбирает файл), дальше раз в `MONITOR_INTERVAL` (10 с); `error` или текст в `adapter.last_error` — `failed` с этой причиной, `idle` при нулевом прогрессе — тоже `failed` |
| `remove_temp_file(path)` | удаление временного G-code; вызывается из `finally` в `process_task()` |
| `run()` | цикл: проверка просьбы о сканировании и очереди проверок принтеров, опрос очереди заданий, запуск заданий в отдельных потоках (`start_job()`), пауза `POLL_INTERVAL`; при `Ctrl+C` — `stop_jobs()`; пульс — отдельным потоком |
| `read_scan_flag(raw)` | `SCAN_NETWORK` → bool: `true`, `1`, `yes`, `on`; всё остальное выключено |
| `discover_farm()` | обход сети (при старте и по просьбе мастера) и отправка находок в `/api/agent/discover`; ошибка не останавливает агента |
| `fetch_scan_request()` | `GET /api/agent/scan-status`; `True`, если мастер нажал «Найти принтеры в сети» |
| `complete_scan_request()` | `POST /api/agent/scan-complete`; снимает флаг после принятых находок |
| `handle_scan_request()` | просьба мастера целиком: флаг → обход → находки → сброс, повтор не чаще `SCAN_RETRY_DELAY` |
| `fetch_probe_requests()` | `GET /api/agent/probe`: просьбы «Проверить связь» из формы принтера (адрес, ключ, SN, секреты) |
| `run_probe(request_payload)` | адаптер → `connect()` → `probe()` → `close()`; ответ или причина отказа из `last_error` |
| `send_probe_result(probe_id, result)` | `POST /api/agent/probe`: модель, SN, прошивка, возможности и причина отказа |
| `handle_probe_requests()` | все просьбы за один опрос: одна неудача не отменяет остальные |
| `scanner.scan_network()` | подсеть → порты 9999/7125/9883/80/443 в 64 потока → список `{ip_address, protocol_type}` |
| `scanner.send_discovered_printers(printers, crm_url, agent_token)` | `POST /api/agent/discover` с Bearer-токеном; `True`, если сервер принял |

Статусы, которые принимает сервер: `printing`, `done`, `failed` — `queued`
ставит только приложение.

## Обработка задания (шаг 4.4)

1. `poll_once()` возвращает задания из `GET /api/agent/tasks`; `run()` запускает
   каждое в отдельном потоке — `start_job(task)`.
2. `process_task()` берёт `id` (jobId), `gcodeUrl` и `printer` задания. Нет
   `gcodeUrl` или у принтера нет адреса/протокола — `failed` в
   `/api/agent/status` и выход: печатать нечего и некуда.
3. G-code скачивается по `gcodeUrl` в `agent/temp/{jobId}.gcode` (расширение
   берётся из ссылки: готовый `.3mf` сохраняется как `{jobId}.3mf` и печатается
   без обёртки) — `requests.get(..., stream=True)`, запись кусками по 64 КБ.
   Папка в `.gitignore`: файлы на десятки мегабайт в репозиторий не попадают.
4. `get_adapter(protocol_type, ip_address, api_key)` → `connect()` →
   `upload_file(local_path, remote_name="{jobId}.gcode")` (для готового проекта —
   `{jobId}.3mf`) → `start_print(remote_name)`. Любой `False` — `failed` и выход.
5. Печать началась — `send_status(jobId, "printing", 0)`, дальше мониторинг.
6. `finally` удаляет `agent/temp/{jobId}.gcode` при любом исходе.

Цикл мониторинга (`monitor_print()`): пауза 10 секунд, затем `get_status()`.
`printing` — в CRM уходит `printing` с прогрессом, но только когда проценты
изменились (одинаковые не повторяются). `idle` или прогресс 100 % — `done` и
выход из цикла; `error` — `failed`. Отказ команды важнее статуса: если адаптер
оставил причину в `last_error` (принтер прислал `result: fail`), уходит `failed`
с этим текстом. `idle` при нулевом прогрессе — печать не начиналась: `failed`
«Принтер не начал печать (ошибка файла)». Незнакомое состояние не закрывает
задание: агент продолжает опрос.

Задания печатаются параллельно: одно задание — один поток, поэтому десять
принтеров фермы работают одновременно. Очередь отдаёт только `queued`, а
`printing` появляется уже после старта печати, поэтому одно и то же задание
приходит в двух опросах подряд — реестр `_active_jobs` отсекает повтор, а
`_active_printers` не пускает второй G-code на занятый станок. Пропуск ничего не
теряет: если печать так и не началась, следующий опрос вернёт задание снова.
При `Ctrl+C` (`stop_jobs()`) агент ждёт активные печати не дольше
`SHUTDOWN_JOIN_TIMEOUT` (30 секунд): печать идёт на принтере, а не в агенте, и
держать процесс часами нельзя.

## Адаптеры принтеров

`agent/adapters/` — интерфейс, реестр протоколов, форматы, фабрика и реализации (шаги
4.2–8.x). Moonraker, OctoPrint, Bambu, PrusaLink, Creality, FlashForge, Elegoo и
Anycubic разговаривают с принтером по-настоящему. Незнакомый протокол —
`UnknownProtocolError`, а `AdapterUnavailableError` («протокол anycubic ещё не
реализован в агенте») остаётся страховкой на протокол без драйвера: первое лечится
исправлением настроек принтера, второе — обновлением агента.

| Файл | Назначение |
|---|---|
| `base.py` | `BasePrinterAdapter` (ABC): `connect()`, `upload_file(local_path, remote_name)`, `start_print(remote_name)`, `get_status()`, `close()`; сверх контракта — `pause_print()`/`resume_print()` (по умолчанию `False`), `probe()`, набор `capabilities` (`CAPABILITY_*`), `accepted_formats`, `secrets` из колонки `printer_secrets`, `protocol_key` и `prepare_upload(local_path, remote_name)` → `UploadPlan` (путь, имя, MD5, размер, признак временного файла) с `cleanup_upload()` |
| `registry.py` | `PROTOCOLS` — восемь `ProtocolSpec` (подпись, «модуль:Класс» драйвера, порты, способ обнаружения, возможности, форматы, имена секретов); `get_protocol()` без учёта регистра и пробелов, `load_adapter_class()` с ленивым импортом; исключения `UnknownProtocolError` и `AdapterUnavailableError` |
| `formats.py` | Форматы и подготовка файла: `sanitize_remote_name()` (ASCII, без папок и `..`, до 255 символов; Creality — `_` вместо пробелов), `ensure_format()` (сверка расширения со справочником, упаковка `.gcode` в `.3mf` для Bambu, проверка записей контейнера для FlashForge), `file_digest()` (MD5 потоком), `wrap_gcode_to_3mf()`, `discard()` и `FormatError` |
| `moonraker.py` | `MoonrakerAdapter` — Klipper: `/server/info`, `/server/files/upload`, `/printer/print/start`, `/printer/objects/query?print_stats&virtual_sdcard` |
| `octoprint.py` | `OctoPrintAdapter` — OctoPrint: `/api/version`, `POST /api/files/local`, `POST /api/files/local/<name>`, `GET /api/job`, команды в `POST /api/job` |
| `prusa.py` | `PrusaAdapter` — PrusaLink: `GET /api/v1/status`, `PUT /api/v1/files/<storage>/<name>`, `POST /api/v1/files/<storage>/<name>`, `GET /api/v1/job`, команды в `/api/v1/job` |
| `creality.py` | `CrealityAdapter` — Creality OS: `GET /info` (модель), `POST /upload/<имя>`, WebSocket 9999 — `heart_beat`, `get` с `ReqPrinterPara`, `set` с `opGcodeFile`, `pause` и `stop` |
| `flashforge.py` | `FlashForgeAdapter` — FlashForge: `GET /detail`, `POST /uploadGcode` (поле `gcodeFile`), `POST /printGcode`, `POST /control`; каждый запрос несёт заголовки `serialNumber` и `checkCode` |
| `elegoo.py` | `ElegooAdapter` — Elegoo (SDCP): WebSocket 3030 с командами `Cmd: 0/128/129/130/131` и `POST /uploadFile/upload` с полями `S-File-MD5`, `Check`, `Offset`, `Uuid`, `TotalSize` |
| `anycubic.py` | `AnycubicAdapter` — Anycubic в LAN-режиме: MQTT 9883 под TLS (`anycubic/anycubicCloud/v1/printer/public/<modeId>/<deviceId>/request` и `/report`) для паспорта и команд, `POST <urls.fileUploadurl>` с файлом в поле `gcode` и заголовком `X-File-Length` |
| `bambu.py` | `BambuAdapter` — Bambu в LAN-режиме: MQTT с TLS (8883) для команд и отчётов, implicit FTPS (990) для файлов |
| `factory.py` | `get_adapter(protocol_type, ip_address, api_key, serial_number="", secrets=None)`: набор аргументов берётся из паспорта протокола (серийник — Bambu и FlashForge, `secrets` — протоколам из `registry`); неизвестный протокол — `UnknownProtocolError("Неизвестный протокол")`, протокол без драйвера — `AdapterUnavailableError`. После сборки ставит `adapter.protocol_key` из паспорта |

### Форматы и подготовка загрузки

Перед сетью файл проходит `prepare_upload()`: имя приводится к безопасному виду, расширение
сверяется со справочником, при необходимости собирается контейнер. Возвращается `UploadPlan` —
что именно уходит на принтер и надо ли удалять файл после загрузки. `upload_file()` адаптера
ловит `FormatError` и `OSError`, кладёт текст в `last_error` и возвращает `False`, поэтому
мастер видит причину («Prusa (PrusaLink) не печатает .3mf — переслайсите в .gcode или .bgcode»),
а не «задание провалилось». Bambu переопределяет `prepare_upload()`: упаковывает `.gcode` в `.3mf`
и переименовывает файл в `<задание>.3mf` — под этим именем его ищет `start_print()`. MD5
(`formats.file_digest`) считают только протоколы, которым он нужен: Anycubic и Elegoo.

Тест без принтера: `python scripts/test-formats.py` — имя с пробелом, MD5, упаковка Bambu,
отказ чужого формата и FlashForge без готового G-code в контейнере.

### Moonraker

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | `GET /server/info` | 200; `klippy_state` из ответа пишется в журнал |
| `upload_file()` | `POST /server/files/upload`: `multipart/form-data`, поле `file`, `root=gcodes` | 201 (200 тоже принимаем) |
| `start_print()` | `POST /printer/print/start?filename=<remote_name>` | 200 |
| `get_status()` | `GET /printer/objects/query?print_stats&virtual_sdcard` | 200 и JSON `result.status` |

Адрес принтера можно указать как `192.168.1.50`, `printer.local:7125` или сразу
`http://192.168.1.50:7125`. Ключ доступа, если он задан, уходит заголовком
`X-Api-Key` в каждом запросе.

`print_stats.state` переводится в статусы агента: `printing` → `printing`,
`standby` и `complete` → `idle`, `error` и `paused` → `error`. Прогресс берётся из
`virtual_sdcard.progress` (доля 0…1) и пересчитывается в проценты, остаток — по
формуле из документации Moonraker: `print_duration / progress − print_duration`
(0, пока прогресс неизвестен). Сетевые ошибки и таймауты (10 с на запрос, 120 с на
загрузку файла) наружу не выпускаются: в журнал уходит причина, методы отвечают
`False`, а `get_status()` — `{"status": "error", "progress": 0, "remaining_time": 0}`.

`get_status()` возвращает `{"status": "printing" \| "paused" \| "idle" \| "error",
"progress": 0…100, "remaining_time": секунды}`. Какой статус задания отправить в
`/api/agent/status` (`printing`, `done`, `failed`), решает main.py, а не адаптер: `paused`
он не считает ни концом печати, ни срывом и продолжает опрос.

### OctoPrint (шаг 8.3)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | `GET /api/version` | 200; версия сервера и API пишутся в журнал |
| `upload_file()` | `POST /api/files/local`: `multipart/form-data`, поле `file`, `select=true`, `print=false` | 201 (200 тоже принимаем) |
| `start_print()` | `POST /api/files/local/<remote_name>` с `{"command": "select", "print": true}` | 204 (200 тоже) |
| `get_status()` | `GET /api/job` | 200 и JSON `state` |
| `pause_print()` / `resume_print()` | `POST /api/job` с `{"command": "pause", "action": "pause"\|"resume"}` | 204 |
| `stop_print()` | `POST /api/job` с `{"command": "cancel"}` | 204 |

`print=false` при загрузке — не осторожность, а порядок: печать запускает отдельная
команда, после того как агент узнал об успешной загрузке и отчитался серверу.

`state` переводится в статусы агента: `Printing`, `Starting`, `Resuming`, `Finishing` →
`printing`; `Paused` и `Pausing` → `paused`; `Operational`, `Offline`, `Closed`,
`Connecting` → `idle`; `Error` и `Cancelling` → `error`, незнакомое состояние — тоже
`error` с записью в журнал. Прогресс берётся из `job.progress.completion` — OctoPrint
отдаёт его сразу в процентах (0…100), — а если вложенного объекта нет, читается верхний
`progress`: так отвечали сборки до 1.3 и прокси перед принтером. Остаток —
`printTimeLeft` в секундах, `None` превращается в 0.

Коды отказа объясняются в `last_error` подсказкой: 401 — ключ не принят, 403 — ключу
запрещено, 409 — файл занят или принтер печатает, 413 — файл больше лимита, 415 — тип
файла не поддерживается. Тест без принтера: `python scripts/test-octoprint.py` — ответы
API имитирует `http.server` на loopback; проверяются URL, `X-Api-Key`, поля multipart,
разбор состояний, отказы 401/404/409/415 и поведение при выключенном принтере.

### PrusaLink (шаг 8.3)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | `GET /api/v1/status` | 200; `printer.state` пишется в журнал |
| `upload_file()` | `PUT /api/v1/files/<storage>/<remote_name>`: тело файла, `Content-Type: application/octet-stream`, `Print-After-Upload: ?0`, `Overwrite: ?1` | 201 (200 тоже) |
| `start_print()` | `POST /api/v1/files/<storage>/<remote_name>` с `{"command": "print"}` | 204 |
| `get_status()` | `GET /api/v1/status` + `GET /api/v1/job` | 200; 204 у задания — «задания нет» |
| `pause_print()` / `resume_print()` / `stop_print()` | `POST /api/v1/job` с `{"action": "pause"\|"resume"\|"stop"}` | 204 |
| то же, если прошивка не знает `POST` | `PUT /api/v1/job` с `{"command": …}`, для отмены — `DELETE /api/v1/job` | 204 |

Хранилище `usb` (флешка) или `local` (внутренняя память) приходит из
`workshop_printers.printer_secrets` — его выбирают в форме принтера («Хранилище»), по
умолчанию `usb`; незнакомое значение тоже даёт `usb` с записью в журнал, а не путь в чужую
папку. `Print-After-Upload: ?0` запрещает печать сразу после загрузки (команду отправляет
агент), `Overwrite: ?1` разрешает перезапись — повтор после обрыва не упирается в 409.

У команд два вида запроса не от нерешительности: прошивки 2.x принимают `POST` с `action`,
а документация PrusaLink описывает `PUT` с `command` и `DELETE` для отмены. Агент шлёт
`POST`, а на 400/404/405 повторяет документированным запросом — иначе на живом принтере
пауза молча не сработала бы, а мастер считал бы, что она включена. `DELETE` с 404 значит,
что печати уже нет: для агента это успех.

`printer.state` переводится так: `PRINTING` → `printing`, `PAUSED` → `paused`, `IDLE`,
`READY`, `BUSY`, `FINISHED`, `STOPPED` → `idle`, `ATTENTION` и `ERROR` → `error` (принтер
ждёт мастера — само не рассосётся), незнакомое состояние — `error`. `progress` уже в
процентах, `time_remaining` — секунды; 204/404 на `/api/v1/job` дают нули и не считаются
срывом печати.

Тест без принтера: `python scripts/test-prusa.py` — фейковый `http.server` проверяет
`PUT`/`POST`/`DELETE`, заголовки `X-Api-Key`, `Print-After-Upload` и `Overwrite`, тело
загрузки, хранилище из секретов, разбор состояний и отказы 401/405/409/415.

### Creality (шаг 4)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | `GET /info` (запасной — `/detail`), затем WebSocket 9999 и `{"ModeCode": "heart_beat"}` | 200 и `{"msg": "ok"}` |
| `upload_file()` | `POST /upload/<remote_name>`: `multipart/form-data`, поле `file` | 200/201 и `{"code": 0}` |
| `start_print()` | `{"method": "set", "params": {"opGcodeFile": "printprt:/usr/data/<remote_name>"}}` | `result` без ошибки |
| `get_status()` | `{"method": "get", "params": {"ReqPrinterPara": 1}}` | `state`, `printProgress`, `printLeftTime` |
| `pause_print()` / `resume_print()` | `{"method": "set", "params": {"pause": 1}}` и `{"pause": 0}` | `result` без ошибки |
| `stop_print()` | `{"method": "set", "params": {"stop": 1}}` | `result` без ошибки |

Creality — единственный протокол без HTTP-команд: команды и телеметрия идут по
WebSocket на 9999, а HTTP остаётся на паспорт и файл. `heart_beat` уходит и при
подключении, и перед каждой командой: прошивка рвёт сокет, который молчит.
`connect()` подтверждения требует: порт 9999 бывает занят чужим приложением, и тогда
команды ушли бы в пустоту.

`state` переводится так: 0 (подготовка) и 1 (печать) → `printing`, 2 (завершено) →
`idle`, 3 и 4 (остановлено) → `error` с причиной в `last_error`, 5 (пауза) → `paused`;
незнакомое число — тоже `error`. Ноль считается печатью намеренно: сразу после
`opGcodeFile` прошивка греет стол и паркует голову, а `idle` в этот момент main.py
прочитал бы как «печать не начиналась» и закрыл задание провалом.

Имя файла приходит из `prepare_upload()` с `_` вместо пробелов — так просит прошивка
Creality. Путь в `opGcodeFile` зависит от модели: сначала `/usr/data/`, на отказе
`/mnt/UDISK/`, рабочая папка запоминается до конца задания. Молчание в ответ на `set`
отказом не считается (часть прошивок команды не подтверждает, а выполняет); отказ —
это `error`, ненулевой `code` или `result` со словами `fail`/`not exist`. Ключ принтера
прошивка не проверяет: поле есть в форме, но в запросы не попадает.

Тест без принтера: `python scripts/test-creality.py` — фейковый HTTP на loopback и
фейковый WebSocket на 9999 проверяют `heart_beat`, `opGcodeFile` с обеими папками,
разбор состояний, паузу и остановку, отказ `.3mf` до сети и порядок портов в сканере.

### FlashForge (шаг 5)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | `GET /detail` с заголовками `serialNumber` и `checkCode` | 200 и данные принтера в `detail` |
| `upload_file()` | `POST /uploadGcode`: `multipart/form-data`, поле `gcodeFile`, заголовки `fileSize`, `printNow: false`, `levelingBeforePrint: true` | 200/201 и `{"code": 0}` |
| `start_print()` | `POST /printGcode` с `{"serialNumber", "checkCode", "fileName", "levelingBeforePrint": true}` | `{"code": 0}` |
| `get_status()` | `GET /detail` | `machineStatus` и `printInfo` |
| `pause_print()` / `resume_print()` / `stop_print()` | `POST /control` с `{"jobCtl_cmd": "pause"\|"continue"\|"cancel"}` | `{"code": 0}` |

FlashForge авторизует запросы заголовками: `serialNumber` приходит из поля «Серийный
номер (SN)» формы принтера, `checkCode` — только из `printer_secrets` (код печатается на
экране принтера, из сети его не узнать). Если номер не заполнили, адаптер берёт его из
`/detail` при подключении; без номера загрузка и команды отклоняются до сети, потому что
пустой заголовок прошивка отвергает ответом, из которого мастеру ничего не понятно.
Пустой `checkCode` подключение не блокирует — часть сборок отдаёт паспорт без него, — но
виден в журнале уже на `connect()`. `checkCode` и SN приходят в задании полем `secrets`
(`printer_secrets` из формы принтера), поэтому прошивка, которая требует код, получает его
с первого же запроса.

`machineStatus` переводится так: `READY` и `COMPLETED` → `idle`, `PRINTING`, `HEATING`,
`HOMING`, `LEVELING` и `BUSY` → `printing`, `PAUSED` → `paused`, `ERROR`, `CANCELLED` и
`STOPPED` → `error` с причиной в `last_error`, незнакомое значение — тоже `error`.
Нагрев и калибровка считаются печатью намеренно: сразу после `/printGcode` прошивка
греет стол, а `idle` в этот момент main.py прочитал бы как «печать не начиналась» и
закрыл задание провалом. Прогресс прошивка отдаёт готовыми процентами (`printProgress`),
остаток — секундами (`remainingTimeEstimation`). Ответ на команду — `{"code": 0,
"message": "Success"}`: ноль успех, остальное отказ с текстом; ответ без `code`
считается подтверждением.

Форматы: `.gcode` у 5M, `.3mf` у AD5X и Creator 5 — записи внутри контейнера проверяет
`formats.py`, поэтому проект без `Metadata/plate_1.gcode` отклоняется до загрузки. Ответ
без `detail` и без полей принтера (`machineStatus`, `printInfo`, `serialNumber`) — это не
FlashForge: на 8898 бывает чужой сервис, и «подключено» там было бы ложью.

Тест без принтера: `python scripts/test-flashforge.py` — фейковый HTTP на loopback
проверяет заголовки, поле `gcodeFile`, тело `/printGcode`, `jobCtl_cmd`, разбор
состояний и отказы, а фейковый UDP-принтер — находку по бродкасту `~M115`.

### Elegoo (шаг 5)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | WebSocket `ws://<ip>:3030/websocket`, `Cmd: 0` с топиком `sdcp/request/0` | конверт с `MainboardID` |
| `upload_file()` | `POST /uploadFile/upload`: `multipart/form-data`, поля `S-File-MD5`, `Check: 1`, `Offset: 0`, `Uuid`, `TotalSize`, файл в поле `File` | 200 и `{"success": true}` |
| `start_print()` | `Cmd: 128` с `{"Filename", "StartLayer": 0, "path_prefix": "/local"}` | `Data.Data.Ack = 0` |
| `get_status()` | `Cmd: 0` | `Attributes` со `Status` и `Progress` |
| `pause_print()` / `stop_print()` / `resume_print()` | `Cmd: 129` / `130` / `131` | `Ack = 0` |

SDCP — два канала: WebSocket 3030 для команд и состояния, HTTP для файла. Команды идут
конвертом `{"Id", "Data": {"Cmd", "Data", "RequestID", "MainboardID", "TimeStamp",
"From"}, "Topic": "sdcp/request/<плата>"}` и адресуются номером платы: до первого ответа
он неизвестен, поэтому `connect()` отправляет `Cmd: 0` с пустым `MainboardID` и топиком
`sdcp/request/0`, а прошивка отвечает своим номером. Номер берётся и из
`printer_secrets` (`mainboardId`) — на случай, когда бродкаст в сети запрещён, — но ответ
принтера главнее: расхождение пишется в журнал. `mainboardId` приходит в задании полем
`secrets` и в форме принтера поле есть, поэтому Elegoo работает и в сети без бродкаста.

MD5 адаптер считает в `prepare_upload()` один раз: прошивка сверяет сумму принятого
файла, и без неё загрузка отклоняется уже после передачи тела. `Status` переводится так:
`printing`, `preheating`, `heating`, `filechecking` и `resuming` → `printing`; `paused` и
`pausing` → `paused`; `idle`, `homed` и `complete` → `idle`; `stopping`, `stopped`,
`error` и `exception` → `error` с причиной. Прогресс — `Progress` в процентах, остаток —
разность `TotalTicks` и `CurrentTicks` (секунды), а у простоя он ноль: тики остаются в
кэше от прошлой печати и показывали бы остаток у законченной детали.

`Attributes` прошивка присылает то объектом, то строкой с JSON внутри, и присылает
частичными пакетами (`Status` и `Progress` могут прийти в разных), поэтому адаптер
дополняет кэш, а не заменяет. Ответ на команду — `Ack`: ноль успех, остальное отказ с
номером ошибки. Молчание считается отказом, а не успехом (в отличие от Creality): SDCP
подтверждает каждую команду, и прошивка, не ответившая на `Cmd: 128`, печать не начнёт.

Тест без принтера: `python scripts/test-elegoo.py` — фейковый WebSocket на 3030 и
фейковый HTTP на loopback проверяют конверты и топики, поля загрузки и MD5, команды
управления, `Ack`, частичные отчёты, разбор состояний и находку по бродкасту `M99999`.

### Anycubic (шаг 6)

| Метод | Запрос | Успех |
|---|---|---|
| `connect()` | MQTT `9883` под TLS (логин и пароль LAN-режима), подписка `anycubic/anycubicCloud/v1/printer/public/+/+/report`, затем `info/query` в `.../public/<modeId>/<deviceId>/request` | `info/report` с `deviceId`, `modeId` и `urls.fileUploadurl` |
| `upload_file()` | `POST <urls.fileUploadurl>`: `multipart/form-data`, файл в поле `gcode`, заголовок `X-File-Length` | 200/201 и `code: 0` |
| `start_print()` | `print/start` с `taskid: "-1"`, `filename`, `md5`, `filetype: 1`, `filesize`, `project_type: 1` | `code: 0` или отчёт с состоянием печати |
| `get_status()` | последний `print/report` | `state`, `progress`, `printLeftTime` |
| `pause_print()` / `resume_print()` / `stop_print()` | `print/pause` / `print/resume` / `print/stop` с номером задачи | `code: 0` или отчёт с ожидаемым состоянием |

Anycubic в LAN-режиме — брокер MQTT на 9883 под TLS и HTTP для файла: сам брокер
файлов не принимает. Сообщение — конверт `{"type", "action", "data", "msgid"}`,
ответ приходит тем же `type` с `action: "report"`: `info/report` — паспорт,
`print/report` — состояние печати и подтверждение команд. `msgid` прошивка
возвращает не всегда, поэтому ответом считается и отчёт с кодом (`code`) или с
ожидаемым состоянием (`state`).

Топики адресуются номером модели и номером устройства:
`anycubic/anycubicCloud/v1/printer/public/<modeId>/<deviceId>/request`. Номера
приходят в первом отчёте, а пока их нет, подписка идёт шаблоном `.../+/+/report`:
шаблон и вызывает первый отчёт, после чего подписка сужается до точного топика —
публиковать в шаблон нельзя, брокер доставит сообщение никому. Оба номера можно
вписать и в `printer_secrets` (`modeId`, `deviceId`) — на случай сети, где
бродкаст запрещён политикой; ответ принтера главнее секретов, расхождение уходит
в журнал.

Логин и пароль — LAN-режим принтера. Форма принтера спрашивает их отдельными полями:
логин уходит в `printer_secrets.username` (по умолчанию `anycubic`), пароль — в
`printer_secrets.password`; ключ `api_key` остаётся запасным путём для принтеров,
заведённых до шага 7 — если пароля в секретах нет, адаптер берёт ключ. mTLS часть
прошивок требует: пара `clientCert`/`clientKey` из секретов включает её, `caCert`
добавляет проверку цепочки, а без него сертификат принтера принимается без проверки —
он самоподписанный.

Адрес загрузки берётся из паспорта (`urls.fileUploadurl`), а не из порта: порт
18910 — запасной путь, когда принтер адрес не назвал, и тогда отказ виден в
`last_error` вместе с HTTP-кодом. Файл уходит `multipart/form-data` в поле `gcode`
(не `file`: прошивка читает именно его, а с чужим именем поля файл приходит
пустым) с заголовком `X-File-Length` — по нему принтер готовит место до чтения
тела. MD5 адаптер считает в `prepare_upload()` один раз: сумма и размер уходят в
`print/start`, потому что `start_print()` получает только имя файла.

`taskid` новой задачи — `-1`; пауза, возврат и остановка несут номер задачи из
отчёта, а до первого отчёта — тот же `-1`. `state` переводится по `_STATE_MAP`:
`printing`, `heating`, `preheating`, `starting`, `resuming` и `busy` — печать
(сразу после `print/start` принтер греет стол и проверяет файл, и `idle` в этот
момент закрыл бы задание провалом), `paused` и `pausing` — пауза, `idle`, `ready`,
`completed`, `complete` и `finished` — простой, `stopped`, `cancelled`, `canceled`,
`error` и `failed` — ошибка с причиной. Отчёты частичные, поэтому кэш дополняется,
а не заменяется. Молчание — отказ: прошивка, не ответившая на `print/start`,
печать не начнёт. Коды отказа переводятся словами: `19007` — имя файла не
заканчивается на `.gcode`, `10105` — принтер занят печатью или проверкой файла.

Тест без принтера: `python scripts/test-anycubic.py` — фейковый брокер на 9883 и
`http.server` на loopback проверяют конверт и топики, адрес загрузки из паспорта,
поле `gcode` и `X-File-Length`, MD5 в `print/start`, подтверждения команд,
частичные отчёты, разбор состояний, коды `19007` и `10105` и находку сканера по
открытому 9883. TLS в тесте выключен флагом `MQTT_TLS`: подделать рукопожатие
нельзя, а конверт сообщений и разбор отчётов проверить нужно.

### Bambu Lab (шаг 7.5)

Bambu в LAN-режиме (Settings → Network → LAN Only Mode) не имеет HTTP API: команды
и отчёты идут по MQTT с TLS, файлы — по implicit FTPS. Второй пароль не нужен:
код доступа с экрана принтера (`LAN Access Code`) — это и есть `api_key`, а логин
всегда `bblp`. Обязательное условие — включённый LAN-режим: в облачном режиме
принтер по локальной сети не отвечает.

| Метод | Что делает | Успех |
|---|---|---|
| `connect()` | MQTT `self.ip_address:8883`, TLS без проверки сертификата, подписка `device/<serial>/report`, команда `pushing.pushall` | CONNACK получен и подписка оформлена |
| `upload_file()` | FTPS `self.ip_address:990`: implicit TLS 1.2 (сессия управляющего канала переиспользуется в канале данных), `PROT P` и `PASV` обязательны, файл кладётся в папку `cache` (`STOR cache/<remote_name>`, папка создаётся через `MKD`); канал данных пишется вручную (`TYPE I` + `STOR` по шагам) с таймаутом `FTP_DATA_TIMEOUT` — `storbinary()` не годится, он висит на `unwrap()` после последнего байта. Если FTPS не прошёл — HTTP `POST /api/files/local` с `X-Api-Key`. Сырой `.gcode` пакуется в контейнер `.3mf` (`zipfile`: `Metadata/plate_1.gcode`, `Metadata/slice_info.config`, `Metadata/model_settings.config`, `3D/3dmodel.model` без геометрии, `[Content_Types].xml` с `Override` на модель, `_rels/.rels`) и грузится как `<задание>.3mf`; временный контейнер удаляется после загрузки. Готовый `.3mf` (проект Bambu Studio) уходит как есть — второй контейнер поверх настоящего прошивка не разбирает | файл загружен |
| `start_print()` | MQTT `device/<serial>/request`, после отправки — ожидание отчёта с тем же `sequence_id` (`COMMAND_REPLY_TIMEOUT`): `result=fail` и `reason` принтера уходят в `last_error`. Поздний `fail` (принтер ответил `success`, а через полминуты не разобрал файл — `error string`, на экране `0500-4003`) помечается в `_command_error`, и `get_status()` отдаёт `error`: задание закрывается как `failed`, а не `done`. Команда — `project_file`: `param=Metadata/plate_1.gcode`, `url=ftp:///cache/<задание>.3mf` (второй вариант — `ftp:///<задание>.3mf`, если прошивка сама подставляет папку). Плоский `.gcode` этой командой не печатается — он заранее упакован в `.3mf` | принтер ответил `success` |
| `get_status()` | последний отчёт: `print.gcode_state`, `print.mc_percent`, `print.mc_remaining_time` | `{"status", "progress", "remaining_time"}` |

Серийный номер. Топики Bambu адресуются серийником, поэтому адаптер берёт его по
цепочке: поле `printer.serialNumber` задания → SSDP-поиск в подсети (UDP 1990,
заголовок `USN`, совпадение `Location` с адресом принтера) → топик первого отчёта
(до этого подписка идёт на `device/+/report`). Без серийника можно получить
состояние, но команду печати отправить нельзя: `start_print()` вернёт `False` и
напишет причину в журнал.

Статусы: `RUNNING` и `PREPARE` → `printing`, `FINISH`, `IDLE` и `STANDBY` → `idle`,
`FAILED` и `PAUSE` → `error`; незнакомое состояние тоже `error`. `mc_remaining_time`
у Bambu в минутах, в ответе адаптера — секунды; при `idle` остаток 0. Отчёты
приходят частичными (только изменившиеся поля), поэтому кэш дополняется, а не
заменяется. Ответы на команды (`command` + `result`) в кэш статуса не попадают: они
разбираются отдельно и пишутся в журнал — иначе отказ команды неотличим от
«команда отправлена». Отказ (`result: fail`) запоминается в `last_error` и в
`_command_error`: пока пометка стоит, `get_status()` отдаёт `error`, даже если
прошивка присылает `idle`. Снимает её только `success` на `project_file` —
новый запуск печати.

Сеть как и у Moonraker: исключения наружу не выпускаются, таймауты обязательны
(10 с на MQTT-подключение, 120 с на загрузку файла). Адаптер — единственный, кто
держит постоянное соединение: `main.py` зовёт `close()` в конце задания, иначе
поток MQTT-клиента остался бы висеть до выхода из процесса.

Тест без принтера: `python scripts/test-bambu.py` — проверяет контракт адаптера,
разбор отчётов, поиск серийника и то, что сетевые методы возвращают `False`, а не
падают на недоступном адресе.

## Диагностика

| Симптом | Причина |
|---|---|
| `AGENT_TOKEN не задан` / `не похож на uuid` | в `.env` остался образец или ключ скопирован не целиком |
| `HTTP 401` | токен сменился в настройках мастерской или принадлежит другой мастерской |
| `HTTP 503` | в базе нет таблиц Мастерской — примените `supabase/workshop_farm_and_shop.sql` |
| `Connection refused` | приложение не запущено или `CRM_URL` указывает не туда |
| `Bambu … не отвечает на MQTT` | принтер не в LAN-режиме (Settings → Network → LAN Only Mode) или адрес не тот |
| `Bambu … не принял MQTT-подключение` | код доступа не совпадает с `LAN Access Code` в настройках принтера |
| `Bambu … серийный номер неизвестен` | номера нет в задании, а SSDP молчит: агент и принтер в разных подсетях |
| `Bambu … печать … не принята (принтер отклонил …)` | принтер не понял команду или не нашёл файл: сверьте `param`/`url` в строке «отправляю …» с путём загрузки, `result`/`reason` пришли от самого принтера |
| `принтер не начал печать (ошибка файла)` | команда принята, но файл не взят в работу: прошивка не разобрала контейнер (на экране `0500-4003`) — сверьте строку «упакован в контейнер …» и `reason` из журнала; для готового `.3mf` проверьте, что в нём есть `Metadata/plate_1.gcode` |
| `принтер отклонил project_file: …` | принтер сам ответил `fail`: причину он пишет в `reason` — чаще всего файл не найден по `url` или не разобран |
| `G-code не упакован в .3mf` | агент не смог создать временный контейнер: нет места в `TEMP` или файл задания не читается |
