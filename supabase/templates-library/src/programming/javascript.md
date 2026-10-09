---
id: javascript
name: JavaScript
description: Core language to objects, classes, built-ins and async code, following the JS Institute JSE and JSA syllabi.
category: custom
source: JS Institute JSE-40-01 and JSA-41-01 exam syllabi, jsinstitute.org; objectives as published, sub-topics condensed by hand.
verified: false
version: 1
---

# JSE 1: Basics of JavaScript and Programming

## Fundamental terms

- Interpreting and compilation, interpreter and compiler
- Client-side and server-side programming

## Programming environment

- Editor, console and debugger
- Online and local set-ups

## Client-side execution

- HTML fundamentals and embedding scripts
- Running code in the browser console

# JSE 2: Variables, Data Types and Type Casting

## Variables

- Naming, declaring and initialising variables
- Constants
- Block scope, shadowing and hoisting

## Primitive types

- boolean, number, bigint, undefined and null
- Ranges and formats of numbers and bigints
- Strings: literals, escapes and interpolation
- String basics: length, charAt, slice, split

## Type casting

- Converting with String, Number, BigInt and Boolean
- Primitive and implicit conversions

## Objects and arrays

- Objects as records: literals, getting and setting properties
- Arrays: length, indexOf, push, unshift, pop, shift
- Arrays: reverse, slice, concat

# JSE 3: Operators and User Interaction

## Operators

- Assignment and compound assignment
- Arithmetic operators and string concatenation
- Logical operators
- Equality and relational operators
- The ternary operator
- typeof, instanceof and delete
- Precedence, associativity and parentheses

## User interaction

- alert, confirm and prompt

# JSE 4: Control Flow

## Conditional execution

- if and if...else, multiple and nested conditions
- switch and case

## Loops

- while and do...while
- break and continue
- for loops over ranges and collections
- for...in over object keys
- for...of over arrays and iterables

# JSE 5: Functions

## Functions

- Declaring and calling functions, arguments and return values
- Parameters, local variables and shadowing
- Function expressions and first-class functions
- Recursion
- Callbacks with setTimeout and setInterval
- Arrow functions

# JSE 6: Errors, Exceptions and Debugging

## Errors and debugging

- Syntax, semantic, logic and runtime errors
- SyntaxError, ReferenceError, TypeError and RangeError
- try...catch...finally and throw
- Stepping through code and inspecting variables
- Measuring execution time

# JSA 1: Classless Objects

## Objects and properties

- Object literals
- Adding, modifying and deleting properties
- Nested properties and optional access
- Dot and bracket notation
- Testing for properties: the in operator
- Enumeration: for...in, Object.keys, values and entries
- Reference equality and structural comparison
- Copying references and cloning values: Object.assign and spread
- Deep cloning strategies

## Methods and accessors

- Methods and this
- Getters and setters

## Configuring and creating objects

- Property descriptors with Object.defineProperty
- preventExtensions, seal and freeze
- Factory functions and constructor functions
- Object.create with explicit prototypes
- Prototypes and prototype-based inheritance
- Object.setPrototypeOf

# JSA 2: Classes

## Classes

- Class declarations and class expressions
- Instantiation with new and instanceof
- Class fields
- Getters and setters in classes
- Inheritance with extends and super
- Static methods and properties
- Classes compared with constructor functions

# JSA 3: Built-in Objects

## Numbers, strings and dates

- Number: conversions and formatting
- String methods: case, split, find and replace, pad and trim
- Date: components, elapsed time, local time and UTC

## Collections

- Arrays: merge, add and remove, slice and splice
- Spread and destructuring
- find, every, some, filter, sort, map and reduce
- Set
- Map
- Plain objects as dictionaries

## JSON, Math and regular expressions

- JSON.stringify and JSON.parse
- Math: rounding, random, min and max, powers, logs and trigonometry
- Regular expressions: test, exec, match, search, replace
- Extending built-in types through prototypes

# JSA 4: Advanced Functions

## Parameters and context

- Default values, rest parameters and spread
- Named parameters with objects and destructuring
- Closures and IIFEs
- this with call, apply and bind
- Decorating functions and higher-order functions

## Generators and iterators

- Generator functions
- Custom iterables and iterators

## Asynchronous programming

- Callbacks and async error handling
- Promises: then, catch and finally
- Promise chaining, Promise.all, any and race
- async and await
- Network requests with XMLHttpRequest and fetch
