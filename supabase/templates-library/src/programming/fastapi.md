---
id: fastapi
name: FastAPI
description: FastAPI from first steps and validation to dependencies, security, databases, testing and deployment.
category: custom
source: The official FastAPI documentation, fastapi.tiangolo.com (Learn, Tutorial - User Guide, Advanced User Guide, Deployment); page titles as published.
verified: false
version: 1
---

# Foundations

## Before you start

- Python types intro
- Concurrency and async / await

# Tutorial: User Guide

## Parameters and request bodies

- First steps
- Path parameters
- Query parameters
- Request body
- Query parameters and string validations
- Path parameters and numeric validations
- Query parameter models
- Body: multiple parameters
- Body: fields
- Body: nested models
- Declaring request example data
- Extra data types
- Cookie and header parameters
- Cookie and header parameter models

## Responses

- Response model and return type
- Extra models
- Response status code
- Handling errors
- Path operation configuration
- JSON compatible encoder
- Body updates

## Forms and files

- Form data and form models
- Request files
- Request forms and files

## Dependencies

- Dependencies
- Classes as dependencies
- Sub-dependencies
- Dependencies in path operation decorators
- Global dependencies
- Dependencies with yield

## Security

- Security first steps
- Getting the current user
- Simple OAuth2 with password and bearer
- OAuth2 with password hashing and JWT bearer tokens

## Building applications

- Middleware
- CORS
- SQL (relational) databases
- Bigger applications: multiple files
- Streaming JSON lines and server-sent events
- Background tasks
- Metadata and docs URLs
- Static files
- Testing
- Debugging

# Advanced User Guide

## Advanced requests and responses

- Path operation advanced configuration
- Additional status codes
- Returning a response directly
- Custom responses: HTML, stream, file
- Additional responses in OpenAPI
- Response cookies and headers
- Using the request directly

## Advanced features

- Advanced dependencies
- OAuth2 scopes and HTTP basic auth
- Advanced middleware
- Sub applications and mounts
- Behind a proxy
- Templates
- WebSockets
- Lifespan events
- Settings and environment variables
- OpenAPI callbacks and webhooks
- Generating SDKs

## Advanced testing

- Testing WebSockets
- Testing lifespan events
- Testing dependencies with overrides
- Async tests

# Deployment

## Deployment

- About FastAPI versions
- About HTTPS
- Running a server manually
- Deployment concepts
- Deploying on cloud providers
- Server workers: Uvicorn with workers
- FastAPI in containers: Docker
