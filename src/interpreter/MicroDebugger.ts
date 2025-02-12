import { Interpreter } from ".";
import { BackTrace, Environment, Scope } from "./Environment";
import { source } from "..";
import { Lexer, Location } from "../lexer";
import { Parser } from "../parser";
import { isIterable, PrimitiveKinds, ValueKind } from "../brsTypes";
import {
    Assignment,
    DottedSet,
    Expression,
    ForEach,
    Increment,
    IndexedSet,
    Print,
} from "../parser/Statement";

// Debug Constants
export enum debugCommand {
    BT,
    CONT,
    EXIT,
    HELP,
    LAST,
    LIST,
    NEXT,
    STEP,
    THREAD,
    THREADS,
    VAR,
    EXPR,
    BREAK,
}
const dataBufferIndex = 32;
let stepMode = false;

export function runDebugger(interpreter: Interpreter, currLoc: Location, lastLoc: Location) {
    // TODO:
    // - Implement stop on error and brkd command
    // - Implement step over and step out
    // - Implement classes, bsc(s) and stats
    const env = interpreter.environment;
    const lastLines = parseTextFile(source.get(lastLoc.file));
    const backTrace = env.getBackTrace();
    const prompt = "Brightscript Debugger> ";
    let debugMsg = "BrightScript Micro Debugger.\r\n";
    let lastLine: number = lastLoc.start.line;
    if (stepMode) {
        postMessage(
            `print,${lastLine.toString().padStart(3, "0")}: ${lastLines[lastLine - 1]}\r\n`
        );
    } else {
        postMessage("debug,stop");
        debugMsg += "Enter any BrightScript statement, debug commands, or HELP\r\n\r\n";

        debugMsg += "\r\nCurrent Function:\r\n";
        let start = Math.max(lastLine - 8, 1);
        let end = Math.min(lastLine + 5, lastLines.length);
        for (let index = start; index < end; index++) {
            const flag = index === lastLine ? "*" : " ";
            debugMsg += `${index.toString().padStart(3, "0")}:${flag} ${lastLines[index - 1]}\r\n`;
        }
        debugMsg += "Source Digest(s):\r\n";
        debugMsg += `pkg: dev ${interpreter.getChannelVersion()} 5c04534a `;
        debugMsg += `${interpreter.manifest.get("title")}\r\n\r\n`;

        debugMsg += `STOP (runtime error &hf7) in ${formatLocation(lastLoc)}\r\n`;
        debugMsg += "Backtrace: \r\n";
        postMessage(`print,${debugMsg}`);
        debugBackTrace(backTrace, currLoc);
        postMessage(`print,Local variables:\r\n`);
        debugLocalVariables(env);
    }
    // Debugger Loop
    while (true) {
        postMessage(`print,\r\n${prompt}`);
        Atomics.wait(interpreter.sharedArray, interpreter.type.DBG, -1);
        let cmd = Atomics.load(interpreter.sharedArray, interpreter.type.DBG);
        Atomics.store(interpreter.sharedArray, interpreter.type.DBG, -1);
        if (cmd === debugCommand.EXPR) {
            debugHandleExpr(interpreter);
            continue;
        }
        if (Atomics.load(interpreter.sharedArray, interpreter.type.EXP)) {
            postMessage("warning,Unexpected parameter");
            continue;
        }
        switch (cmd) {
            case debugCommand.CONT:
                stepMode = false;
                interpreter.debugMode = false;
                postMessage("debug,continue");
                return true;
            case debugCommand.STEP:
                stepMode = true;
                interpreter.debugMode = true;
                return true;
            case debugCommand.EXIT:
                return false;
        }
        debugHandleCommand(interpreter, currLoc, lastLoc, cmd);
    }
}

function debugHandleExpr(interpreter: Interpreter) {
    const lexer = new Lexer();
    const parser = new Parser();
    interpreter.debugMode = false;
    let expr = debugGetExpr(interpreter.sharedArray);
    const exprScan = lexer.scan(expr, "debug");
    const exprParse = parser.parse(exprScan.tokens);
    if (exprParse.statements.length > 0) {
        const exprStmt = exprParse.statements[0];
        try {
            if (exprStmt instanceof Assignment) {
                interpreter.visitAssignment(exprStmt);
            } else if (exprStmt instanceof DottedSet) {
                interpreter.visitDottedSet(exprStmt);
            } else if (exprStmt instanceof IndexedSet) {
                interpreter.visitIndexedSet(exprStmt);
            } else if (exprStmt instanceof Print) {
                interpreter.visitPrint(exprStmt);
            } else if (exprStmt instanceof Expression) {
                interpreter.visitExpression(exprStmt);
            } else if (exprStmt instanceof Increment) {
                interpreter.visitIncrement(exprStmt);
            } else if (exprStmt instanceof ForEach) {
                interpreter.visitForEach(exprStmt);
            } else {
                console.log(exprStmt);
                postMessage(`print,Debug command/expression not supported!\r\n`);
            }
        } catch (err: any) {
            // ignore to avoid crash
        }
    } else {
        postMessage("error,Syntax Error. (compile error &h02) in $LIVECOMPILE");
    }
}

function debugGetExpr(buffer: Int32Array): string {
    let expr = "";
    buffer.slice(dataBufferIndex).every((char) => {
        if (char > 0) {
            expr += String.fromCharCode(char).toLocaleLowerCase();
        }
        return char; // if \0 stops decoding
    });
    return expr;
}

function debugHandleCommand(
    interpreter: Interpreter,
    currLoc: Location,
    lastLoc: Location,
    cmd: number
) {
    const env = interpreter.environment;
    const backTrace = env.getBackTrace();
    const lastLines = parseTextFile(source.get(lastLoc.file));
    const currLines = parseTextFile(source.get(currLoc.file));
    let lastLine: number = lastLoc.start.line;
    let currLine: number = currLoc.start.line;
    let debugMsg: string;
    switch (cmd) {
        case debugCommand.BT:
            debugBackTrace(backTrace, currLoc);
            break;
        case debugCommand.HELP:
            debugHelp();
            break;
        case debugCommand.LAST:
            postMessage(
                `print,${lastLine.toString().padStart(3, "0")}: ${lastLines[lastLine - 1]}\r\n`
            );
            break;
        case debugCommand.LIST:
            const flagLine = currLoc.file === lastLoc.file ? lastLine : currLine;
            debugList(backTrace, currLines, flagLine);
            break;
        case debugCommand.NEXT:
            postMessage(
                `print,${currLine.toString().padStart(3, "0")}: ${currLines[currLine - 1]}\r\n`
            );
            break;
        case debugCommand.THREAD:
            debugMsg = "Thread selected: ";
            debugMsg += ` 0*   ${formatLocation(currLoc).padEnd(40)}${lastLines[
                lastLine - 1
            ].trim()}`;
            postMessage(`print,${debugMsg}\r\n`);
            break;
        case debugCommand.THREADS:
            debugMsg = "ID    Location                                Source Code\r\n";
            debugMsg += ` 0*   ${formatLocation(currLoc).padEnd(40)}${lastLines[
                lastLine - 1
            ].trim()}\r\n`;
            debugMsg += "  *selected";
            postMessage(`print,${debugMsg}\r\n`);
            break;
        case debugCommand.VAR:
            debugLocalVariables(env);
            break;
        case debugCommand.BREAK:
            postMessage(`warning,Micro Debugger already running!\r\n`);
            break;
        default:
            postMessage(`warning,Invalid Debug command/expression!\r\n`);
            break;
    }
}

function debugBackTrace(backTrace: BackTrace[], stmtLoc: Location) {
    let debugMsg = "";
    let loc = stmtLoc;
    for (let index = backTrace.length - 1; index >= 0; index--) {
        const func = backTrace[index];
        const kind = ValueKind.toString(func.signature.returns);
        let args = "";
        func.signature.args.forEach((arg) => {
            args += args !== "" ? "," : "";
            args += `${arg.name.text} As ${ValueKind.toString(arg.type.kind)}`;
        });
        debugMsg += `#${index}  Function ${func.functionName}(${args}) As ${kind}\r\n`; // TODO: Correct signature
        debugMsg += `   file/line: ${formatLocation(loc)}\r\n`;
        loc = func.callLoc;
    }
    postMessage(`print,${debugMsg}`);
}

function debugList(backTrace: BackTrace[], currLines: string[], flagLine: number) {
    if (backTrace.length > 0) {
        const func = backTrace[backTrace.length - 1];
        const start = func.functionLoc.start.line;
        const end = Math.min(func.functionLoc.end.line, currLines.length);
        for (let index = start; index <= end; index++) {
            let flag = index === flagLine ? "*" : " ";
            postMessage(
                `print,${index.toString().padStart(3, "0")}:${flag} ${currLines[index - 1]}\r\n`
            );
        }
    }
}

function debugLocalVariables(environment: Environment) {
    let debugMsg = `${"global".padEnd(16)} Interface:ifGlobal\r\n`;
    debugMsg += `${"m".padEnd(16)} roAssociativeArray count:${
        environment.getM().getElements().length
    }\r\n`;
    let fnc = environment.getList(Scope.Function);
    fnc.forEach((value, key) => {
        if (PrimitiveKinds.has(value.kind)) {
            debugMsg += `${key.padEnd(16)} ${ValueKind.toString(
                value.kind
            )} val:${value.toString()}\r\n`;
        } else if (isIterable(value)) {
            debugMsg += `${key.padEnd(16)} ${value.getComponentName()} count:${
                value.getElements().length
            }\r\n`;
        } else if (value.kind === ValueKind.Object) {
            debugMsg += `${key.padEnd(17)}${value.getComponentName()}\r\n`;
        } else {
            debugMsg += `${key.padEnd(17)}${value.toString()}\r\n`;
        }
    });
    postMessage(`print,${debugMsg}`);
}

function debugHelp() {
    let debugMsg = "";

    debugMsg += "Command List:\r\n";
    debugMsg += "   bt              Print backtrace of call function context frames\r\n";
    // debugMsg += "   brkd            Break on BrightScript diagnostics\r\n"
    // debugMsg += "   classes         List public classes\r\n"
    debugMsg += "   cont|c          Continue script execution\r\n";
    // debugMsg += "   down|d          Move down the function context chain one\r\n"
    debugMsg += "   exit|q          Exit shell\r\n";
    // debugMsg += "   gc              Run garbage collector\r\n"
    debugMsg += "   last|l          Show last line that executed\r\n";
    debugMsg += "   next|n          Show the next line to execute\r\n";
    debugMsg += "   list            List current function\r\n";
    // debugMsg += "   bsc             List BrightScript Component instances\r\n"
    // debugMsg += "   bscs            Summarize BrightScript Component instances\r\n"
    // debugMsg += "   stats           Shows statistics\r\n"
    debugMsg += "   step|s|t        Step one program statement\r\n";
    debugMsg += "   thread|th       Show selected thread\r\n";
    // debugMsg += "   thread|th <id>  Select one thread for inspection\r\n"
    debugMsg += "   threads|ths     List all threads of execution\r\n";
    debugMsg += "   over|v          Step over one program statement (for now act as step)\r\n";
    debugMsg += "   out|o           Step out from current function (for now act as step)\r\n";
    // debugMsg += "   up|u            Move up the function context chain one\r\n"
    debugMsg += "   var             Display local variables and their types/values\r\n";
    debugMsg += "   print|p|?       Print variable value or expression\r\n\r\n";
    debugMsg += "   Type any expression for a live compile and run, in the context\r\n";
    debugMsg += "   of the current function.  Put the 'stop' statement in your code\r\n";
    debugMsg += "   to trigger a breakpoint.  Then use 'c', 's', or other commands.\r\n";
    postMessage(`print,${debugMsg}`);
}

function formatLocation(location: Location) {
    let formattedLocation: string;
    if (location.start.line) {
        formattedLocation = `pkg:/${location.file}(${location.start.line})`;
    } else {
        formattedLocation = `pkg:/${location.file}(??)`;
    }
    return formattedLocation;
}

// This function takes a text file content as a string and returns an array of lines
function parseTextFile(content?: string): string[] {
    let lines: string[] = [];
    if (content) {
        lines = content.split("\n");
    }
    return lines;
}
