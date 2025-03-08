# Resin.js

A lightweight reactive library for enhancing native web development. Resin provides reactivity, and aims to remove common pain points found in vanilla JavaScript web development.

4.6kb minified, 1.9kb gzipped with zero dependencies.

> **Beta Notice:** Enhanced array and maps and all related methods are experimental and not yet fully functional. Expect breaking changes as I continue to develop a more ergonomic API around these data types.

## Features

- 🎯 Zero-dependency DOM binding
- 🔄 Simple, powerful state management
- 📦 No build step required
- 🎨 Framework-agnostic
- 🚀 Predictable performance
- 🎭 TypeScript-first

## Installation

```bash
npm install @resin-js/core
```

## Basic Usage

```javascript
import { resin, bindInnerText } from '@resin-js/core';

// Create reactive state
const counter = resin(0);

// Bind to DOM
bindInnerText(document.querySelector('.counter'), counter);

// Updates automatically
counter.value++; // DOM updates instantly
```

## Core Concepts

### State Management

```javascript
// Simple values
const count = resin(0);

// Complex objects
const user = resin({
    name: 'John',
    settings: {
        theme: 'dark',
        notifications: true
    }
});

// Arrays
const todos = resin([
    { id: 1, text: 'Learn Resin', done: false }
]);

// Maps
const userMap = resin(new Map());
```

### DOM Binding

```javascript
// Basic binding helpers
bindInnerText(element, state);                    // Text content binding
bindVisibility(element, state);                   // Conditional visibility
bindClass(element, state, { active: v => v > 0 }); // Class bindings
bindAttr(element, state, { disabled: v => !v });   // Attribute bindings

// Full-featured binding
bind(element, state, {
    bindInnerText: true,                // Set text content/value
    if: value => value > 0,             // Conditional visibility
    map: value => `Count: ${value}`,    // Transform display value
    class: {                            // Class toggling
        'active': value => value.isActive,
        'disabled': value => !value.isEnabled
    },
    attr: {                             // Attribute binding
        'disabled': value => !value.isValid,
        'aria-expanded': value => value.isOpen
    }
});
```

### Computed Values

```javascript
import { computed } from '@resin-js/core';

const firstName = resin('John');
const lastName = resin('Doe');

const fullName = computed(() => 
    `${firstName.value} ${lastName.value}`
);
```

### Derived Values

```javascript
import { derive } from '@resin-js/core';

const firstName = resin('John');
const lastName = resin('Doe');
const age = resin(30);

// Combine multiple resin values
const person = derive({
    from: [firstName, lastName, age],
    compute: (first, last, age) => ({
        fullName: `${first} ${last}`,
        isAdult: age >= 18
    })
});
```

### Subscribing to Changes

```javascript
import { subscribe } from '@resin-js/core';

const counter = resin(0);

// Run effects when state changes
subscribe(() => {
    console.log(`Counter is now: ${counter.value}`);
    if (counter.value % 10 === 0) {
        console.log('Counter is divisible by 10!');
    }
});
```

### Selecting Nested Properties

```javascript
import { select } from '@resin-js/core';

const user = resin({
    profile: {
        name: 'John',
        address: {
            city: 'New York'
        }
    }
});

// Create a reactive view of a nested property
const city = select(user, 'profile.address.city');

// Updating the nested property
user.value.profile.address.city = 'San Francisco';
// city.value now reflects the change
```

### Batch Updates

```javascript
import { batch } from '@resin-js/core';

batch(() => {
    state1.value = newValue1;
    state2.value = newValue2;
    // DOM updates once at the end
});
```

### Event Handling

```javascript
state.on('init', ({ value }) => {
    console.log('Initial value:', value);
});

state.on('change', ({ value, oldValue }) => {
    console.log('Value changed:', oldValue, '->', value);
});

state.on('error', ({ error }) => {
    console.error('Error occurred:', error);
});

state.on('dispose', ({ value }) => {
    console.log('State disposed with final value:', value);
});
```

## Advanced Features

### Persistence

```javascript
const settings = resin({
    theme: 'light'
}, {
    persist: {
        key: 'app-settings',
        // Optional custom serialization
        serialize: JSON.stringify,
        deserialize: JSON.parse
    }
});
```

### Validation

```javascript
const form = resin({
    email: ''
}, {
    validate: value => ({
        valid: value.email.includes('@'),
        error: 'Invalid email format'
    })
});
```

### Transform Pipeline

```javascript
const input = resin('', {
    transform: [
        value => value.trim(),
        value => value.toLowerCase()
    ]
});
```

### Debugging

```javascript
import { enableDebug } from '@resin-js/core';

// Enable debug mode for detailed logs
enableDebug();
```

## Experiemental (May not be fully functional, subject to change as I continue to develop)

### Array Operations (EXPERIMENTAL)

```javascript
const todos = resin([
    { id: 1, text: 'Learn Resin', done: false },
    { id: 2, text: 'Build app', done: true }
]);

// Reactive filtering
const activeTodos = todos.rFilter(todo => !todo.done);

// Reactive mapping
const todoTexts = todos.rMap(todo => todo.text);

// Reactive find
const firstActive = todos.rFind(todo => !todo.done);

// Sorted view
const sortedTodos = todos.rSort((a, b) => a.id - b.id);

// Sliced view
const firstThreeTodos = todos.rSlice(0, 3);

// Regular array operations work too
todos.value.push({ id: 3, text: 'New todo', done: false });
```

### Map Operations (EXPERIMENTAL)

```javascript
const users = resin(new Map([
    ['user1', { name: 'John', age: 30 }]
]));

// Reactive get
const user1 = users.rGet('user1');

// Reactive entries
const entries = users.rEntries();

// Reactive keys
const userIds = users.rKeys();

// Reactive values
const userObjects = users.rValues();

// Regular Map operations work
users.value.set('user2', { name: 'Jane', age: 25 });
```

## Use Cases

- Enhanced vanilla JavaScript applications
- Progressive enhancement of existing sites
- Small to medium web applications
- Form handling
- Dynamic UI updates
- Real-time data display
- Interactive components

## Why Resin?

- **Simple Mental Model**: Just state and bindings
- **Progressive Enhancement**: Add reactivity where needed
- **Framework Freedom**: Works with any JavaScript code
- **Type Safety**: Full TypeScript support
- **Predictable Updates**: Direct DOM manipulation
- **Small Learning Curve**: Familiar JavaScript patterns

## Browser Support

Supports all modern browsers (ES2015+).

## License

MIT

## Contributing

Contributions welcome! Please read our contributing guidelines and code of conduct.

## Packages

- `@resin-js/core`: Core reactivity system