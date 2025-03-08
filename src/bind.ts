import { watchEffect } from "./resin";
import { BindOptions, Resin } from "./types";

/**
 * Binds a Resin state to an HTML element with full binding options.
 * This is the core binding function that provides complete control over how state
 * is reflected in the DOM. For common use cases, consider using the specialized
 * binding functions like `bindInnerText`, `bindVisibility`, etc.
 *
 * @example
 * // Basic binding
 * const counter = resin(0);
 * bind(counterElement, counter, { bindInnerText: true });
 *
 * @example
 * // Complex binding with multiple options
 * const formState = resin({
 *   value: '',
 *   valid: false,
 *   touched: false,
 *   submitting: false
 * });
 *
 * bind(formElement, formState, {
 *   // Show element only when not submitting
 *   if: state => !state.submitting,
 *
 *   // Transform the displayed value
 *   map: state => state.value.toUpperCase(),
 *
 *   // Conditionally apply CSS classes
 *   class: {
 *     'is-valid': state => state.valid && state.touched,
 *     'is-invalid': state => !state.valid && state.touched,
 *     'is-pristine': state => !state.touched
 *   },
 *
 *   // Set attributes based on state
 *   attr: {
 *     'aria-invalid': state => !state.valid,
 *     'disabled': state => state.submitting,
 *     'data-state': state => state.touched ? 'touched' : 'untouched'
 *   }
 * });
 *
 * @example
 * // Binding with automatic cleanup
 * const { dispose } = bind(element, state, { bindInnerText: true });
 *
 * // Later when no longer needed
 * dispose();
 *
 * @example
 * // The binding is automatically cleaned up if the element is removed from the DOM
 * document.body.removeChild(element); // Binding is disposed automatically
 */
export function bind<T>(element: HTMLElement, resin: Resin<T>, options: BindOptions<T> = {}): { dispose: () => void } {
    const config = {
        ...options,
        bindInnerText: options.bindInnerText !== undefined ? options.bindInnerText : false
    }
    const originalDisplay = element.style.display;

    const effect = () => {
        const value = resin.value;
        if (config.if) {
            const shouldShow = config.if(value);
            element.style.display = shouldShow ? originalDisplay : 'none';
            if (!shouldShow) {
                return;
            }
        }

        const displayValue = options.map ? options.map(value) : value;

        if (config.bindInnerText) {
            if (element instanceof HTMLInputElement) {
                element.value = String(displayValue);
            } else {
                element.textContent = String(displayValue);
            }
        }

        if (config.class) {
            Object.entries(config.class).forEach(([className, predicate]) => {
                if (predicate(value)) {
                    element.classList.add(className);
                } else {
                    element.classList.remove(className);
                }
            });
        }

        if (config.attr) {
            Object.entries(config.attr).forEach(([attr, getter]) => {
                const attrValue = getter(value);
                if (attrValue === false) {
                    element.removeAttribute(attr);
                } else if (attrValue === true) {
                    element.setAttribute(attr, '');
                } else {
                    element.setAttribute(attr, String(attrValue));
                }
            });
        }
    };

    watchEffect(effect);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.removedNodes.forEach((node) => {
                if (node === element) {
                    resin._subscribers.delete(effect);
                    observer.disconnect();
                }
            });
        });
    });

    observer.observe(element.parentElement!, { childList: true });

    return {
        dispose() {
            resin._subscribers.delete(effect);
            observer.disconnect();
        },
    };
}

/**
 * Binds an element's visibility to a Resin value using a predicate function.
 * When the predicate returns false, the element is hidden using display: none.
 * 
 * @example
 * const isVisible = resin(true);
 * bindVisibility(myElement, isVisible);
 * 
 * // With custom predicate
 * const count = resin(0);
 * bindVisibility(myElement, count, value => value > 10);
 */
export function bindVisibility<T>(
    element: HTMLElement,
    resin: Resin<T>,
    callback: (value: T) => boolean = (value: T) => !!value
) {
    return bind(element, resin, { if: callback })
}

/**
 * Binds an element's text content (or value for input elements) to a Resin value.
 * The element's content will automatically update when the Resin value changes.
 * 
 * @example
 * const message = resin('Hello World');
 * bindInnerText(document.querySelector('.greeting'), message);
 * 
 * // Later when the value changes, the DOM updates automatically
 * message.value = 'Welcome!';
 */
export function bindInnerText<T>(element: HTMLElement, resin: Resin<T>) {
    return bind(element, resin, { bindInnerText: true });
}

/**
 * Binds CSS classes to an element based on conditions derived from a Resin value.
 * Classes are added when their predicates return true and removed when they return false.
 * 
 * @example
 * const formState = resin({ valid: false, active: true });
 * bindClass(formElement, formState, {
 *   'is-valid': value => value.valid,
 *   'is-invalid': value => !value.valid,
 *   'is-active': value => value.active
 * });
 */
export function bindClass<T>(element: HTMLElement, resin: Resin<T>, conditionalClasses: {
    [className: string]: (value: T) => boolean;
}) {
    return bind(element, resin, { class: conditionalClasses });
}

/**
 * Binds HTML attributes to an element based on values derived from a Resin state.
 * Attributes are set, updated, or removed based on the return value of their getter functions.
 * 
 * @example
 * const buttonState = resin({ enabled: false, expanded: true });
 * bindAttr(buttonElement, buttonState, {
 *   'disabled': value => !value.enabled,
 *   'aria-expanded': value => value.expanded,
 *   'title': value => value.enabled ? 'Click me' : 'Currently disabled'
 * });
 */
export function bindAttr<T>(element: HTMLElement, resin: Resin<T>, attrConfig: {
    [attrName: string]: (value: T) => string | boolean | number;
}) {
    return bind(element, resin, { attr: attrConfig });
}