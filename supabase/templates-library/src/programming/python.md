---
id: python
name: Python
description: From first programs to modules, OOP and file I/O, following the Python Institute PCEP and PCAP syllabi.
category: custom
source: Python Institute PCEP-30-02 and PCAP-31-03 exam syllabi, pythoninstitute.org; objectives as published, sub-topics condensed by hand.
verified: false
version: 1
---

# PCEP 1: Computer Programming and Python Fundamentals

## Fundamental terms and definitions

- Interpreting and the interpreter, compilation and the compiler
- Lexis, syntax and semantics

## Python's logic and structure

- Keywords and instructions
- Indentation
- Comments

## Literals, variables and numeral systems

- Booleans, integers and floating-point numbers
- Scientific notation
- Strings
- Binary, octal, decimal and hexadecimal numeral systems
- Variables and naming conventions
- PEP 8 recommendations

## Operators and data types

- Numeric operators: power, multiplication, division, modulo, floor division, addition, subtraction
- String operators: concatenation and replication
- Assignment and shortcut operators
- Unary and binary operators, priorities and binding
- Bitwise operators
- Boolean operators and Boolean expressions
- Relational operators
- Accuracy of floating-point numbers
- Type casting

## Console input and output

- print() and input()
- The sep= and end= keyword parameters
- int() and float()

# PCEP 2: Control Flow

## Conditional statements

- if, if-else, if-elif and if-elif-else
- Multiple and nested conditional statements

## Iterations

- The pass instruction
- Loops with while, for, range() and in
- Iterating through sequences
- while-else and for-else
- Nesting loops and conditional statements
- break and continue

# PCEP 3: Data Collections

## Lists

- Indexing and slicing
- len(), sorted() and list methods
- The del instruction
- Iterating through lists with for
- in and not in
- List comprehensions
- Copying and cloning
- Lists in lists: matrices and cubes

## Tuples

- Indexing, slicing, building and immutability
- Tuples and lists: similarities and differences
- Lists inside tuples and tuples inside lists

## Dictionaries

- Building, indexing, adding and removing keys
- Iterating through keys and values
- Checking whether a key exists
- keys(), items() and values()

## Strings

- Constructing strings
- Indexing, slicing and immutability
- Escaping with the backslash
- Quotes and apostrophes inside strings
- Multi-line strings
- Basic string functions and methods

# PCEP 4: Functions and Exceptions

## Functions

- Defining and invoking functions and generators
- return and returning results
- None
- Recursion

## Functions and their environment

- Parameters and arguments
- Positional, keyword and mixed argument passing
- Default parameter values
- Name scopes, shadowing and the global keyword

## Built-in exceptions hierarchy

- BaseException, Exception, SystemExit and KeyboardInterrupt
- Abstract exceptions: ArithmeticError and LookupError
- IndexError, KeyError, TypeError and ValueError

## Exception handling basics

- try-except
- Ordering the except branches
- Propagating exceptions through function boundaries
- Delegating responsibility for handling exceptions

# PCAP 1: Modules and Packages

## Importing modules and packages

- import, from ... import, import as and importing everything
- Qualifying nested modules
- dir() and sys.path

## The math, random and platform modules

- math: ceil(), floor(), trunc(), factorial(), hypot(), sqrt()
- random: random(), seed(), choice(), sample()
- platform: platform(), machine(), processor(), system(), version()

## User-defined modules and packages

- The pycache directory
- The dunder name variable
- Public and private variables
- The dunder init.py file
- Searching for modules and packages
- Nested packages and directory trees

# PCAP 2: Exceptions

## Handling Python-defined exceptions

- try and except, except ... as, grouped exceptions
- The exceptions hierarchy
- raise and assert
- Exception classes and the args property
- else and finally

## Self-defined exceptions

- Defining custom exceptions
- Fitting custom exceptions into the hierarchy

# PCAP 3: Strings

## Character representation

- ASCII, Unicode and UTF-8
- Code points and escape sequences

## Operating on strings

- ord() and chr()
- Indexing, slicing and immutability
- Iteration, concatenation, repetition and comparison
- in and not in

## String methods

- .isxxx(), .join(), .split(), .strip()
- .index(), .find(), .rfind()
- Ordering strings with sorted()

# PCAP 4: Object-Oriented Programming

## The object-oriented approach

- Class, object, property and method
- Encapsulation and inheritance
- Superclasses and subclasses

## Class and object properties

- Instance and class variables
- The dunder dict property
- Private components and name mangling

## Methods

- Declaring and using methods
- The self parameter

## Class structure

- Introspection and hasattr()
- The dunder name, module and bases properties

## Inheritance

- Single and multiple inheritance
- isinstance(), is and is not
- Polymorphism and overriding the dunder str method
- The diamond problem

## Constructors

- Declaring and invoking constructors

# PCAP 5: Miscellaneous

## List comprehensions

- Conditions with if
- Nested comprehensions

## Lambdas

- Defining and using lambdas
- Functions that take lambdas as arguments
- map() and filter()

## Closures

- Meaning, definition and use of closures

## Input and output

- I/O modes and predefined streams
- Handles and streams, text and binary modes
- open() and errno
- close(), read(), write(), readline(), readlines()
- bytearray as an I/O buffer
