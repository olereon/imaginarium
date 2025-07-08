# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Imaginarium is an AI-powered content generation pipeline automation platform built with a TypeScript monorepo architecture. It provides a visual pipeline builder, robust backend processing, and real-time collaboration features.

## Architecture

This is a monorepo using npm workspaces with the following structure:

- **`apps/client/`** - React frontend (Vite + TypeScript + Tailwind + Ant Design)
- **`apps/server/`** - Express backend API (TypeScript + Prisma + SQLite + Redis)
- **`packages/shared/`** - Shared types, schemas, and utilities
- **`libs/core/`** - Core pipeline engine and node system
- **`libs/ui/`** - Reusable UI components library

### Package Dependencies
- `apps/client` depends on `libs/ui` and `packages/shared`
- `apps/server` depends on `libs/core` and `packages/shared`
- `libs/ui` depends on `packages/shared`
- `libs/core` depends on `packages/shared`

### Key Technologies
- **Frontend**: React 18, Vite, Tailwind CSS, Ant Design, Zustand, React Router, React Flow, Socket.io
- **Backend**: Express.js, TypeScript, Prisma ORM, SQLite, Redis, Bull queues, Socket.io, Winston logging
- **Testing**: Vitest across all packages
- **Build**: TypeScript project references for efficient incremental builds

## Development Commands

### Essential Commands
```bash
# Setup and Development
npm install                    # Install all dependencies
npm run build:libs            # Build shared libraries first (required before dev)
npm run dev                   # Start all development servers
npm run dev:client            # Start only client (port 5173)
npm run dev:server            # Start only server (port 3000)

# Building
npm run build                 # Build all packages
npm run build:libs            # Build libraries only
npm run build:apps            # Build applications only

# Testing
npm run test                  # Run all tests
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Run tests with coverage
npm run test:client           # Test specific package
npm run test:server           # Test specific package
npm run test:shared           # Test specific package
npm run test:core             # Test specific package
npm run test:ui               # Test specific package

# Code Quality
npm run lint                  # Lint and fix all packages
npm run lint:check            # Lint without fixing
npm run format                # Format all code with Prettier
npm run format:check          # Check formatting
npm run typecheck             # Type check all packages

# Database
npm run prisma:generate       # Generate Prisma client
npm run prisma:migrate        # Run database migrations
npm run prisma:studio         # Open Prisma Studio
npm run prisma:seed           # Seed database
npm run db:push               # Push schema changes to database
```

### Package-Specific Commands
Use `npm run <command> --workspace=<package>` format:
```bash
npm run build --workspace=@imaginarium/server
npm run test --workspace=@imaginarium/client
```

## Build Process

1. **Always build libs first**: `npm run build:libs` before development
2. **Project references**: Uses TypeScript project references for efficient builds
3. **Incremental builds**: `npm run build:watch` for development

## Database

- **ORM**: Prisma with SQLite (development) and PostgreSQL (production)
- **Location**: `prisma/schema.prisma` contains the complete database schema
- **Key models**: User, Pipeline, PipelineRun, TaskExecution, ExecutionLog
- **Features**: Comprehensive user management, pipeline versioning, execution tracking, file uploads

## Configuration

- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Configured with React, TypeScript, and accessibility rules
- **Prettier**: Automatic code formatting
- **Path mapping**: Use `@imaginarium/shared`, `@imaginarium/ui`, `@imaginarium/core` imports
- **Environment**: `.env` file for local configuration

## Testing Strategy

- **Framework**: Vitest for all packages
- **Frontend**: React Testing Library for component tests
- **Backend**: Supertest for API integration tests
- **Coverage**: Available with `npm run test:coverage`

## Docker Support

```bash
npm run docker:dev            # Start development environment
npm run docker:dev:logs       # View logs
npm run docker:dev:stop       # Stop services
npm run docker:prod           # Production build
```

## Git Workflow

- **Commits**: Use conventional commits (feat:, fix:, docs:, etc.)
- **Pre-commit**: Husky runs lint, format, and type check
- **Branches**: Use `feature/`, `bugfix/`, `hotfix/` prefixes
- **Main branch**: `main` (for production), `develop` (for integration)

## Important Notes

- **Build order**: Libraries must be built before applications
- **Cross-package imports**: Use proper workspace imports (`@imaginarium/...`)
- **Database changes**: Run `prisma:generate` after schema changes
- **Port conflicts**: Client (5173), Server (3000), ensure these ports are available
- **Dependencies**: Use `npm install <package> --workspace=<target>` to add dependencies to specific packages

## Debugging

- **Frontend**: React DevTools, browser DevTools with source maps
- **Backend**: VS Code debugger with tsx, Winston logging
- **Database**: Use `npm run prisma:studio` for GUI access

## Common Issues

1. **Build failures**: Ensure `npm run build:libs` is run first
2. **Type errors**: Run `npm run typecheck` to identify issues
3. **Database issues**: Check if `prisma:generate` was run after schema changes
4. **Port conflicts**: Ensure ports 3000 and 5173 are available