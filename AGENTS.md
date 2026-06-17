# AGENTS.md — trading-office

> Гид для AI-агентов (Codex, Claude Code и др.). Быстрый контекст + команды, чтобы
> не тратить токены на разбор репозитория.

## Что это
**Визуальная диспетчерская (control room)** для агентных торговых систем —
pixel-art «офис», где каждый AI-агент превращается в спрайт за столом с живым
статусом (`running…`, `thinking…`, `backtesting…`, `reviewing…`). Это витрина и
пульт наблюдения поверх других систем, а не торговая система.

⚠️ **Ключевой принцип — no execution authority.** Офис только **читает** состояние
внешних сервисов и рисует его. Ни одной команды на запись/исполнение в нём нет.
- Истина по исполнению/данным — `trading-platform`.
- Первая подключённая агентная система — `trading-lab` (её 7 агентов на «этаже» офиса).
- В demo/research можно указывать на `trading-mock-platform` без изменения кода.

## Стек
- **TypeScript**, npm workspaces (монорепо): `apps/`, `packages/`, `examples/`, `tools/`
- Веб-клиент `@trading-office/web` (pixel-art фронтенд), сервер `@trading-office/server`
- `concurrently` для одновременного запуска server+web
- Read-only коннекторы к Ops Read / Research Read surfaces

## Структура
- `apps/` — приложения (`web` — фронтенд-офис, `server` — бэкенд-коннектор)
- `packages/` — общие пакеты (в т.ч. `@trading-office/trading-lab-floor`)
- `examples/trading-lab-research-floor/` — пример «этажа»
- `tools/` — утилиты (напр. `sync-floor-public.mjs` синхронизирует ассеты)
- `docs/`, `HOW_TO_USE.md` — документация и инструкция

## Команды
```bash
npm install
npm run dev              # dev веб-клиента (@trading-office/web)
npm run dev:server       # dev сервера
npm run dev:connected    # server + web одновременно (concurrently)
npm run dev:web:connected
npm run build            # сборка всех workspaces
npm run typecheck        # типы по всем workspaces
npm run test             # тесты по всем workspaces
npm run generate         # генерация этажа trading-lab-floor
npm run verify:assets    # проверка синхронизации ассетов этажа

# Подключение к mock-платформе (без правок кода) — переменные окружения:
#   OFFICE_CONNECTOR_MODE=trading-lab
#   OFFICE_PLATFORM_ENABLED=true
#   TRADING_PLATFORM_READ_URL=http://localhost:8839
#   TRADING_PLATFORM_READ_TOKEN=<non-empty>
```

## Правила для агента
- **Никакой execution-логики.** Офис read-only — не добавляй запись/команды на торговлю.
- Данные берутся только с read-surfaces (Ops Read / Research Read); не лезь напрямую в БД платформы.
- Ассеты этажа держи синхронными (`verify:assets` должен проходить).
- Соблюдай границы workspaces — общий код выноси в `packages/`, не дублируй.
- README/документация и уточняющие вопросы — на русском.

## Навигация по коду
Для поиска символов/связей предпочитай codegraph MCP вместо ручного grep+read.
