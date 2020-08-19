export function debounce(fn, wait) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    }
}

export function until(fn, predicateFn) {
    let canRun = true;
    return (...args) => {
        if ((canRun = predicateFn())) {
            fn(args);
        }
    }
}