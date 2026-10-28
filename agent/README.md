# Локальный агент 3D-фермы

Python-скрипт, который работает на компьютере мастера и разбирает очередь печати
Мастерской: спрашивает у приложения задания (`GET /api/agent/tasks`) и умеет
сообщать их статус (`POST /api/agent/status`). Сервер и его контракт описаны в
`app/api/agent/tasks/route.ts` и `app/api/agent/status/route.ts`, проверка токена —
в `lib/agent-auth.ts`.

Текущее состояние — **шаг 4.4**. Шаг 4.1 — каркас и цикл опроса: агент читает
`.env`, раз в `POLL_INTERVAL` секунд запрашивает очередь и пишет в журнал, сколько
задач пришло. Шаг 4.2 — интерфейс и фабрика адаптеров. Шаг 4.3 — `MoonrakerAdapter`
с реальными HTTP-запросами: проверка связи, загрузка G-code, старт печати и
состояние. Шаг 4.4 — обработка заданий целиком: `process_task()` скачивает G-code
в `agent/temp/`, ведёт его через адаптер и мониторит печать. Адаптеры
OctoPrint/Bambu — следующие шаги.

## Требования

- Python 3.8 или новее (`python --version`).
- Заполненные настройки мастерской в приложении: токен агента (`agent_token`)
  выдаётся таблицей `workshop_settings` (миграция `supabase/workshop_farm_and_shop.sql`).

## Установка зависимостей

Из папки `agent/`:

```bash
pip install -r requirements.txt
```

Зависимости: `requests` (HTTP), `python-dotenv` (чтение `.env`), `websockets`
(понадобится адаптерам принтеров, сейчас только объявлена).

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
2026-10-28 12:00:05 | INFO    | Получено 2 задач
2026-10-28 12:00:05 | INFO    |   задание 6f1c… | заказ: Ваза 15 см | Принтер №1
2026-10-28 12:00:10 | ERROR   | Очередь не запрошена: HTTPConnectionPool… Max retries exceeded
```

Агент не вылетает при сетевых ошибках: запрос уходит в журнал, цикл ждёт
следующий интервал. Ответы `401` (токен не принят), `503` (нет таблиц — не
применена миграция) и таймауты (`REQUEST_TIMEOUT = 10` секунд) тоже не
останавливают процесс.

## Что в коде

| Функция | Назначение |
|---|---|
| `setup_logging()` | журнал в консоль: дата, время, уровень, сообщение |
| `load_settings()` | читает `.env` в `Settings`, проверяет `CRM_URL` и формат uuid у токена |
| `fetch_tasks()` | `GET /api/agent/tasks`, возвращает список заданий (пустой — «печатать нечего») |
| `send_status(job_id, status, progress=None)` | `POST /api/agent/status`; `True`, если сервер записал статус |
| `poll_once()` | один опрос: задачи и строка `Получено N задач` |
| `process_task(task)` | задание целиком: скачать G-code → адаптер → загрузка → печать → мониторинг |
| `download_gcode(url, path)` | `requests.get(..., stream=True)` в `agent/temp/`, запись кусками по 64 КБ |
| `monitor_print(job_id, adapter)` | опрос `get_status()` раз в `MONITOR_INTERVAL` (10 с) до `done`/`failed` |
| `remove_temp_file(path)` | удаление временного G-code; вызывается из `finally` в `process_task()` |
| `run()` | цикл: опрос очереди, затем задания по одному, пауза `POLL_INTERVAL` |

Статусы, которые принимает сервер: `printing`, `done`, `failed` — `queued`
ставит только приложение.

## Обработка задания (шаг 4.4)

1. `poll_once()` возвращает задания из `GET /api/agent/tasks`; `run()` идёт по
   ним циклом и вызывает `process_task(task)`.
2. `process_task()` берёт `id` (jobId), `gcodeUrl` и `printer` задания. Нет
   `gcodeUrl` или у принтера нет адреса/протокола — `failed` в
   `/api/agent/status` и выход: печатать нечего и некуда.
3. G-code скачивается по `gcodeUrl` в `agent/temp/{jobId}.gcode`
   (`requests.get(..., stream=True)`, запись кусками по 64 КБ). Папка в
   `.gitignore`: файлы на десятки мегабайт в репозиторий не попадают.
4. `get_adapter(protocol_type, ip_address, api_key)` → `connect()` →
   `upload_file(local_path, remote_name="{jobId}.gcode")` → `start_print(remote_name)`.
   Любой `False` — `failed` и выход.
5. Печать началась — `send_status(jobId, "printing", 0)`, дальше мониторинг.
6. `finally` удаляет `agent/temp/{jobId}.gcode` при любом исходе.

Цикл мониторинга (`monitor_print()`): пауза 10 секунд, затем `get_status()`.
`printing` — в CRM уходит `printing` с прогрессом, но только когда проценты
изменились (одинаковые не повторяются). `idle` или прогресс 100 % — `done` и
выход из цикла; `error` — `failed`. Незнакомое состояние не закрывает задание:
агент продолжает опрос.

Задания обрабатываются строго последовательно: пока `process_task()` не вернул
управление, `run()` не запрашивает очередь — второй G-code не уйдёт на принтер,
который ещё печатает.

## Адаптеры принтеров

`agent/adapters/` — интерфейс, фабрика и реализации протоколов (шаги 4.2–4.3).
Moonraker разговаривает с принтером по-настоящему; OctoPrint и Bambu пока
заглушки — их методы поднимают `NotImplementedError`.

| Файл | Назначение |
|---|---|
| `base.py` | `BasePrinterAdapter` (ABC): `connect()`, `upload_file(local_path, remote_name)`, `start_print(remote_name)`, `get_status()` |
| `moonraker.py` | `MoonrakerAdapter` — Klipper: `/server/info`, `/server/files/upload`, `/printer/print/start`, `/printer/objects/query?print_stats&virtual_sdcard` |
| `octoprint.py` | `OctoPrintAdapter` — заглушка; нужен REST API OctoPrint (`/api/files/local`, `/api/job`) |
| `bambu.py` | `BambuAdapter` — заглушка; в LAN-режиме это MQTT (8883) и FTPS (990) |
| `factory.py` | `get_adapter(protocol_type, ip_address, api_key)`; неизвестный протокол — `ValueError("Неизвестный протокол")` |

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

`get_status()` возвращает `{"status": "printing" \| "idle" \| "error", "progress": 0…100,
"remaining_time": секунды}`. Какой статус задания отправить в `/api/agent/status`
(`printing`, `done`, `failed`), решает main.py, а не адаптер.

Протокол `octoprint` есть в `PRINTER_PROTOCOLS` приложения: фабрика его принимает,
но методы адаптера поднимают `NotImplementedError` — реальный REST API OctoPrint
(выбор файла, `POST /api/job` с `command=start`) это отдельная задача.

## Диагностика

| Симптом | Причина |
|---|---|
| `AGENT_TOKEN не задан` / `не похож на uuid` | в `.env` остался образец или ключ скопирован не целиком |
| `HTTP 401` | токен сменился в настройках мастерской или принадлежит другой мастерской |
| `HTTP 503` | в базе нет таблиц Мастерской — примените `supabase/workshop_farm_and_shop.sql` |
| `Connection refused` | приложение не запущено или `CRM_URL` указывает не туда |
