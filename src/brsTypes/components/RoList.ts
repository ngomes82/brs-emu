import { BrsType, Int32, RoArray } from "..";
import { BrsValue, ValueKind, BrsBoolean, BrsInvalid } from "../BrsType";
import { BrsComponent, BrsIterable } from "./BrsComponent";
import { Callable, StdlibArgument } from "../Callable";
import { Interpreter } from "../../interpreter";

export class RoList extends BrsComponent implements BrsValue, BrsIterable {
    readonly kind = ValueKind.Object;
    elements: BrsType[];
    currentIndex: number;

    constructor(elements?: BrsType[]) {
        super("roList");
        if (elements) {
            this.elements = new Array<BrsType>(...elements);
        } else {
            this.elements = new Array<BrsType>();
        }
        this.currentIndex = -1;
        this.registerMethods({
            ifList: [
                this.addHead,
                this.addTail,
                this.getHead,
                this.getTail,
                this.removeHead,
                this.removeTail,
                this.resetIndex,
                this.getIndex,
                this.removeIndex,
            ],
            ifListToArray: [this.toArray],
            ifArray: [
                this.peek,
                this.pop,
                this.push,
                this.shift,
                this.unshift,
                this.delete,
                this.count,
                this.clear,
                this.append,
            ],
            ifArrayGet: [this.getEntry],
            ifArraySet: [this.setEntry],
            ifEnum: [this.isEmpty],
        });
    }

    toString(parent?: BrsType): string {
        if (parent) {
            return "<Component: roList>";
        }

        return [
            "<Component: roList> =",
            "(",
            ...this.elements.map((el: BrsValue) => `    ${el.toString(this)}`),
            ")",
        ].join("\n");
    }

    equalTo(_other: BrsType) {
        return BrsBoolean.False;
    }

    getValue() {
        return this.elements;
    }

    getElements() {
        return this.elements.slice();
    }

    get(index: BrsType) {
        switch (index.kind) {
            case ValueKind.Float:
                return this.getElements()[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            case ValueKind.Int32:
                return this.getElements()[index.getValue()] || BrsInvalid.Instance;
            case ValueKind.String:
                return this.getMethod(index.value) || BrsInvalid.Instance;
            default:
                postMessage(
                    "warning,List indexes must be 32-bit integers, or method names must be strings."
                );
                return BrsInvalid.Instance;
        }
    }

    set(index: BrsType, value: BrsType) {
        if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
            this.elements[Math.trunc(index.getValue())] = value;
        } else {
            postMessage("warning,List indexes must be 32-bit integers.");
        }
        return BrsInvalid.Instance;
    }

    add(element: BrsType, onTail: boolean = true) {
        if (onTail) {
            this.elements.push(element);
        } else {
            this.elements.unshift(element);
            if (this.currentIndex >= 0) {
                this.currentIndex++;
            }
        }
    }

    remove(index: number) {
        let removed;
        if (index === 0) {
            removed = this.elements.shift();
        } else if (index === this.tail()) {
            removed = this.elements.pop();
        } else {
            removed = this.elements.splice(index, 1)[0];
        }
        if (removed && this.currentIndex > index) {
            this.currentIndex--;
        }
        if (this.currentIndex >= this.elements.length) {
            this.currentIndex = -1;
        }
        return removed;
    }

    getCurrent() {
        const index = this.currentIndex;
        if (index >= 0) {
            this.currentIndex++;
            if (this.currentIndex >= this.elements.length) {
                this.currentIndex = -1;
            }
        }
        return this.elements[index];
    }

    length() {
        return this.elements.length;
    }

    tail() {
        return this.elements.length - 1;
    }

    //--------------------------------- ifList ---------------------------------

    /** Adds typed value to head of list */
    private addHead = new Callable("addHead", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.add(tvalue, false);
            return BrsInvalid.Instance;
        },
    });

    /** Adds typed value to tail of list */
    private addTail = new Callable("addTail", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.elements.push(tvalue);
            return BrsInvalid.Instance;
        },
    });

    /** Gets the entry at head of list and keep entry in list */
    private getHead = new Callable("getHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[0] || BrsInvalid.Instance;
        },
    });

    /** Gets the Object at tail of List and keep Object in list */
    private getTail = new Callable("getTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[this.tail()] || BrsInvalid.Instance;
        },
    });

    /** Removes entry at head of list */
    private removeHead = new Callable("removeHead", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(0) || BrsInvalid.Instance;
        },
    });

    /** Removes entry at tail of list */
    private removeTail = new Callable("removeTail", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(this.tail()) || BrsInvalid.Instance;
        },
    });

    /** Resets the current index or position in list to the head element */
    private resetIndex = new Callable("resetIndex", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            this.currentIndex = this.elements.length > 0 ? 0 : -1;
            return BrsBoolean.from(this.currentIndex === 0);
        },
    });

    /** Gets the entry at current index or position from the list and increments the index or position in the list */
    private getIndex = new Callable("getIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.getCurrent() ?? BrsInvalid.Instance;
        },
    });

    /** Removes the entry at the current index or position from the list and increments the index or position in the list */
    private removeIndex = new Callable("removeIndex", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(this.currentIndex) || BrsInvalid.Instance;
        },
    });

    //--------------------------------- ifListToArray ---------------------------------

    /** Returns an roArray containing the same elements as the list */
    private toArray = new Callable("toArray", {
        signature: {
            args: [],
            returns: ValueKind.Object,
        },
        impl: (_: Interpreter) => {
            return new RoArray(this.elements);
        },
    });

    //--------------------------------- ifArray ---------------------------------

    private peek = new Callable("peek", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.elements[this.tail()] || BrsInvalid.Instance;
        },
    });

    private pop = new Callable("pop", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(this.tail()) || BrsInvalid.Instance;
        },
    });

    private push = new Callable("push", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.elements.push(tvalue);
            return BrsInvalid.Instance;
        },
    });

    private shift = new Callable("shift", {
        signature: {
            args: [],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter) => {
            return this.remove(0) || BrsInvalid.Instance;
        },
    });

    private unshift = new Callable("unshift", {
        signature: {
            args: [new StdlibArgument("tvalue", ValueKind.Dynamic)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, tvalue: BrsType) => {
            this.add(tvalue, false);
            return BrsInvalid.Instance;
        },
    });

    private delete = new Callable("delete", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Dynamic)],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter, index: BrsType) => {
            if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
                return this.remove(index.getValue()) ? BrsBoolean.True : BrsBoolean.False;
            }
            return BrsBoolean.False;
        },
    });

    private count = new Callable("count", {
        signature: {
            args: [],
            returns: ValueKind.Int32,
        },
        impl: (_: Interpreter) => {
            return new Int32(this.elements.length);
        },
    });

    private clear = new Callable("clear", {
        signature: {
            args: [],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter) => {
            this.elements = new Array<BrsType>();
            this.currentIndex = -1;
            return BrsInvalid.Instance;
        },
    });

    private append = new Callable("append", {
        signature: {
            args: [new StdlibArgument("array", ValueKind.Object)],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, array: BrsComponent) => {
            if (!(array instanceof RoArray || array instanceof RoList)) {
                // TODO: validate against RBI
                return BrsInvalid.Instance;
            }

            this.elements = [
                ...this.elements,
                ...array.elements.filter((element) => !!element), // don't copy "holes" where no value exists
            ];

            return BrsInvalid.Instance;
        },
    });

    //------------------------------- ifArrayGet --------------------------------

    /** Returns an array entry based on the provided index. */
    private getEntry = new Callable("getEntry", {
        signature: {
            args: [new StdlibArgument("index", ValueKind.Dynamic)],
            returns: ValueKind.Dynamic,
        },
        impl: (_: Interpreter, index: BrsType) => {
            if (index.kind === ValueKind.Int32 || index.kind === ValueKind.Float) {
                return this.elements[Math.trunc(index.getValue())] || BrsInvalid.Instance;
            }
            return BrsInvalid.Instance;
        },
    });

    //------------------------------- ifArraySet --------------------------------

    private setEntry = new Callable("setEntry", {
        signature: {
            args: [
                new StdlibArgument("index", ValueKind.Dynamic),
                new StdlibArgument("tvalue", ValueKind.Dynamic),
            ],
            returns: ValueKind.Void,
        },
        impl: (_: Interpreter, index: BrsType, tvalue: BrsType) => {
            return this.set(index, tvalue);
        },
    });

    //--------------------------------- ifEnum ---------------------------------
    private isEmpty = new Callable("isEmpty", {
        signature: {
            args: [],
            returns: ValueKind.Boolean,
        },
        impl: (_: Interpreter) => {
            return BrsBoolean.from(this.elements.length === 0);
        },
    });
}
