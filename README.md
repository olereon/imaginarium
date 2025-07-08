# Imaginarium

AI content generation pipeline automation platform.

## Workspace Structure

This is a monorepo using npm workspaces with the following structure:

```
imaginarium/
├── apps/
│   ├── client/          # React frontend (Vite + TypeScript)
│   └── server/          # Express backend (Node.js + TypeScript)
├── packages/
│   └── shared/          # Shared types, schemas, and utilities
├── libs/
│   ├── ui/              # Reusable UI components
│   └── core/            # Core pipeline engine and business logic
└── [config files]       # Root configuration files
```

## Quick Start

```bash
# Install all dependencies
npm install

# Run development servers
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Lint all packages
npm run lint
```

## Package Scripts

### Root Scripts

- `npm run dev` - Start all development servers
- `npm run build` - Build all packages
- `npm run test` - Run tests in all packages
- `npm run lint` - Lint all packages
- `npm run typecheck` - Type check all packages
- `npm run clean` - Clean all build artifacts

### Individual Package Scripts

- `npm run dev:client` - Start client development server
- `npm run dev:server` - Start server development server
- `npm run build:client` - Build client application
- `npm run build:server` - Build server application
- `npm run test:client` - Run client tests
- `npm run test:server` - Run server tests

## Development

### Adding Dependencies

```bash
# Add to root (affects all packages)
npm install package-name

# Add to specific workspace
npm install package-name --workspace=apps/client

# Add dev dependency to specific workspace
npm install -D package-name --workspace=apps/server
```

### Running Commands in Workspaces

```bash
# Run command in specific workspace
npm run command --workspace=apps/client

# Run command in all workspaces
npm run command --workspaces
```

## Architecture

- **Frontend**: React 18 + TypeScript + Vite + Ant Design
- **Backend**: Node.js + Express + TypeScript + SQLite/PostgreSQL
- **Shared**: Common types, schemas, and utilities
- **UI Library**: Reusable components with Storybook
- **Core Library**: Pipeline engine and business logic

## Contributing

1. Follow conventional commits format
2. Run `npm run lint` before committing
3. Ensure all tests pass
4. Update documentation as needed

See [PRD.md](./PRD.md) for detailed project specifications.
