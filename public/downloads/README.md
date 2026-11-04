# Слот для TriDiAgent.exe

Здесь должен лежать собранный агент печати — файл `TriDiAgent.exe`. Кнопка
«Скачать TriDiAgent.exe» в Мастерской (шапка, онбординг и страница помощи) ведёт
ровно на `/downloads/TriDiAgent.exe`.

## Почему файла нет в git

`TriDiAgent.exe` — это бинарник на десятки мегабайт (внутри интерпретатор Python,
`requests`, `python-dotenv`, `paho-mqtt` и `websockets`). В репозиторий его не
кладут: он собирается из исходников и обновляется вместе с ними. Агент кода
(Cline) собрать exe не может — ему доступен только исходный код, поэтому в
репозитории подготовлен слот и эта инструкция.

## Как собрать и положить файл

На машине с Python 3.8+ и Windows, из корня проекта:

```powershell
cd agent
pip install -r requirements.txt
python build_exe.py
```

Скрипт соберёт `agent/dist/TriDiAgent.exe`. Скопируйте его в этот каталог:

```powershell
copy agent\dist\TriDiAgent.exe public\downloads\TriDiAgent.exe
```

Затем пересоберите и задеплойте сайт: Next.js отдаёт файлы из `public/` как
статику. Для стенда на Amvera `npm run build:amvera` копирует `public/` в
standalone-сборку — exe попадёт туда автоматически.

## Что проверить перед публикацией

- Размер: `~15 МБ` — тот, что обещает подсказка у кнопки. Точный размер зависит
  от версии PyInstaller и зависимостей; если он сильно больше, поправьте текст
  подсказки в `components/workshop/AgentDownloadButton.tsx`.
- Запуск: двойной клик на чистой Windows без Python. При первом запуске рядом с
  exe создаётся `.env` из зашитого `.env.example`.
- Подпись: exe не подписан сертификатом code signing (это платная услуга),
  поэтому SmartScreen покажет «Неизвестный издатель». Так и написано в FAQ —
  врать пользователю про «безопасно и подписано» нельзя.
- Содержимое: `Select-String -Path .\TriDiAgent.exe -Pattern 'api/agent'`
  находит только адреса API агента; личных данных и сторонних доменов внутри
  быть не должно.

Подробности — `agent/README.md` (сборка), `agent/AUTOSTART.md` (автозапуск) и
`agent/SECURITY.md` (что агент делает и как отозвать доступ).
