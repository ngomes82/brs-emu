let foundError = false;

export function make(message: string, line: number, file?: string) {
    let location = file ? `${file}: ${line}` : `line ${line}`;
    if (process.env.NODE_ENV !== "test") {
        console.error(`[${location}] ${message}`);
    }

    foundError = true;
}

export function found() {
    return foundError;
}

export function reset() {
    foundError = false;
}