# Никич: Путь к Пиву

Браузерный 2D-платформер сбоку: Никич идёт по Варшаве к Пиву. Спека — [docs/SPEC.md](docs/SPEC.md), термины — [GLOSSARY.md](GLOSSARY.md).

## Запуск

ES-модули не работают с `file://`, нужен локальный сервер:

```bash
node tools/serve.mjs
```

или `python -m http.server 8000`.

Открыть http://localhost:8000.

## Тесты

```bash
node --test
```

Зависимостей нет.
