---
id: flask
name: Flask
description: Flask from the quickstart and tutorial to templates, testing, blueprints, configuration, patterns, security and deployment.
category: custom
source: The official Flask documentation (3.1.x), flask.palletsprojects.com, User's Guide; section and page titles as published.
verified: false
version: 1
---

# Getting Started

## Installation

- Python version and dependencies
- Virtual environments
- Installing Flask

## Quickstart

- A minimal application
- Debug mode
- HTML escaping
- Routing
- Static files
- Rendering templates
- Accessing request data
- Redirects and errors
- About responses
- Sessions
- Message flashing
- Logging
- Using Flask extensions
- Deploying to a web server

## Tutorial

- Project layout
- Application setup
- Defining and accessing the database
- Blueprints and views
- Templates
- Static files
- Blog blueprint
- Making the project installable
- Test coverage
- Deploying to production

# Core Features

## Templates

- Jinja setup and the standard context
- Controlling autoescaping
- Registering filters
- Context processors
- Streaming

## Testing Flask applications

- Identifying tests and fixtures
- The test client
- Following redirects
- Accessing and modifying the session
- The CLI runner
- Tests that depend on an active context

## Handling application errors

- Error logging tools
- Error handlers and custom error pages
- Blueprint error handlers
- Returning API errors as JSON
- Debugging application errors

## Logging and configuration

- Basic logging configuration
- Configuration basics and built-in values
- Configuring from Python files, data files and environment variables
- Development and production configuration
- Instance folders

## Signals and class-based views

- Core signals, subscribing and creating signals
- Class-based views
- Method dispatching and APIs

# Application Structure

## Application structure and lifecycle

- How a request is handled
- The application context
- The request context

## Blueprints and extensions

- The concept of blueprints
- Registering and nesting blueprints
- Blueprint resources and building URLs
- Finding, using and building extensions

## Command line interface

- Application discovery
- Running the development server
- Environment variables from dotenv
- Custom commands
- Working with the shell

# Patterns, Security and Deployment

## Patterns for Flask

- Large applications as packages
- Application factories
- SQLite 3 and SQLAlchemy in Flask
- Uploading files
- Caching
- View decorators
- Form validation with WTForms
- Template inheritance
- JavaScript, fetch and JSON
- Background tasks with Celery
- Single-page applications

## Security considerations

- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- JSON security
- Security headers
- Host header validation

## Deployment and async

- Self-hosted options and hosting platforms
- Async with gevent
- Using async and await
