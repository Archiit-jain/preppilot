---
id: machine-learning
name: Machine Learning
description: Google's Machine Learning Crash Course: regression, classification, data, generalisation, neural networks, embeddings, LLMs and production ML.
category: custom
source: Google Machine Learning Crash Course, developers.google.com/machine-learning/crash-course; modules as published, learning objectives condensed by hand.
verified: false
version: 1
---

# Introduction

## Introduction to machine learning

- What machine learning is
- Supervised and unsupervised learning
- Features, labels and models

# ML Models

## Linear regression

- The linear model: weights and bias
- Loss functions
- Gradient descent
- Hyperparameters: learning rate, batch size and epochs

## Logistic regression

- Calculating a probability with the sigmoid function
- Log loss
- Regularisation in logistic regression

## Classification

- Thresholds for binary classification
- Confusion matrix
- Accuracy, precision, recall and related metrics
- ROC curves and AUC
- Prediction bias
- Multi-class classification

# Data

## Working with numerical data

- Feature vectors
- Exploring features visually and statistically
- Outliers
- Normalisation techniques
- Binning
- Qualities of good numerical features

## Working with categorical data

- Categorical compared with numerical data
- One-hot encoding
- Common issues with categorical data
- Feature crosses

## Datasets, generalisation and overfitting

- Characteristics of data and datasets
- Causes of unreliable data
- Missing data: discarding or imputing
- Direct and derived labels
- Improving human-rated labels
- Training, validation and test sets
- Overfitting and its causes
- Regularisation: bias and variance, L2 regularisation, early stopping

# Advanced ML Models

## Neural networks

- Why neural networks
- Nodes, hidden layers and activation functions
- Inference in a neural network
- Training with backpropagation
- Multi-class classification: one-vs-all and one-vs-one

## Embeddings

- Word embeddings such as word2vec
- Encoding compared with embedding
- Contextual embeddings

## Large language models

- Types of language models and their components
- How LLMs are created: context and parameters
- Self-attention and transformers
- Problems with LLMs
- Fine-tuning and distillation

# Real-world ML

## Production ML systems

- Components of a production ML system
- Static and dynamic training
- Static and dynamic inference
- Testing ML deployments
- Monitoring ML pipelines

## Automated machine learning

- Automating ML workflow tasks
- Benefits and limitations of AutoML
- Common AutoML patterns

## Fairness

- Human biases reproduced by ML
- Exploring data for sources of bias
- Evaluating predictions for bias
