import readline from "readline";
import fs from "fs";
import { spawnSync, spawn } from "child_process";
import path from "path";

const builtins = ["type", "echo", "exit", "pwd", "cd"];

let lastTabInput = "";
let tabCount = 0;

function findLongestCommonPrefix(strings) {
    if (strings.length === 0) return "";
    if (strings.length === 1) return strings[0];

    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
        while (prefix.length > 0 && !strings[i].startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
        }
        if (prefix === "") break;
    }
    return prefix;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: (line) => {
        const completions = ["echo", "exit", "type", "pwd", "cd"];
        const path = process.env.PATH.split(":");

        path.forEach((dir) => {
            try {
                const files = fs.readdirSync(dir);
                files.forEach((file) => {
                    const filePath = `${dir}/${file}`;
                    try {
                        const stats = fs.statSync(filePath);
                        if (stats.isFile() && stats.mode & parseInt("111", 8)) {
                            completions.push(file);
                        }
                    } catch (err) {
                        // ignore error
                    }
                });
            } catch (err) {
                // ignore error
            }
        });

        const uniqueCompletions = [...new Set(completions)];
        const hits = uniqueCompletions.filter((c) => c.startsWith(line));

        if (line === lastTabInput) {
            tabCount++;
        } else {
            tabCount = 1;
            lastTabInput = line;
        }

        if (hits.length === 0) {
            process.stdout.write("\x07");
            return [[], line];
        }

        if (hits.length === 1) {
            return [hits.map((c) => c + " "), line];
        }

        const longestPrefix = findLongestCommonPrefix(hits);

        if (longestPrefix.length > line.length) {
            return [[longestPrefix], line];
        } else {
            if (tabCount === 1) {
                process.stdout.write("\x07");
                return [[], line];
            } else if (tabCount === 2) {
                process.stdout.write("\n");
                hits.sort();
                process.stdout.write(hits.join("  "));
                process.stdout.write("\n");
                setImmediate(() => {
                    rl.prompt();
                });
                return [[], line];
            }
        }

        return [[], line];
    },
});

const findExecutable = (command) => {
    const path_dirs = process.env.PATH.split(":");
    for (let dir of path_dirs) {
        if (!dir) continue;

        const filePath = `${dir}/${command}`;
        try {
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.isFile() && stats.mode & parseInt("111", 8)) {
                    return filePath;
                }
            }
        } catch (error) {
            continue;
        }
    }
    return null;
};

function parseArguments(input) {
    const args = [];
    let current = "";
    let isSingle = false;
    let isDouble = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === "\\" && !isSingle && i + 1 < input.length) {
            const nextChar = input[i + 1];
            if (isDouble) {
                if (
                    nextChar === '"' ||
                    nextChar === "\\" ||
                    nextChar === "$" ||
                    nextChar === "`" ||
                    nextChar === "\n"
                ) {
                    current += nextChar;
                    i++;
                } else {
                    current += char;
                }
            } else {
                current += nextChar;
                i++;
            }
            continue;
        }

        if (char === "'" && !isDouble) {
            isSingle = !isSingle;
            continue;
        }

        if (char === '"' && !isSingle) {
            isDouble = !isDouble;
            continue;
        }

        if (char === " " && !isSingle && !isDouble) {
            if (current.length > 0) {
                args.push(current);
                current = "";
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        args.push(current);
    }

    return args;
}

function parseRedirection(args) {
    let outputFile = null;
    let errorFile = null;
    let appendOutput = false;
    let appendError = false;
    let filteredArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === ">>" || arg === "1>>") {
            if (i + 1 < args.length) {
                outputFile = args[i + 1];
                appendOutput = true;
                i++;
            }
        } else if (arg === ">" || arg === "1>") {
            if (i + 1 < args.length) {
                outputFile = args[i + 1];
                appendOutput = false;
                i++;
            }
        } else if (arg === "2>") {
            if (i + 1 < args.length) {
                errorFile = args[i + 1];
                appendError = false;
                i++;
            }
        } else if (arg === "2>>") {
            if (i + 1 < args.length) {
                errorFile = args[i + 1];
                appendError = true;
                i++;
            }
        } else if (arg.startsWith("1>>")) {
            outputFile = arg.slice(3);
            appendOutput = true;
        } else if (arg.startsWith(">>")) {
            outputFile = arg.slice(2);
            appendOutput = true;
        } else if (arg.startsWith("1>")) {
            outputFile = arg.slice(2);
            appendOutput = false;
        } else if (arg.startsWith(">")) {
            outputFile = arg.slice(1);
            appendOutput = false;
        } else if (arg.startsWith("2>>")) {
            errorFile = arg.slice(3);
            appendError = true;
        } else if (arg.startsWith("2>") && arg.length > 2) {
            errorFile = arg.slice(2);
            appendError = false;
        } else {
            filteredArgs.push(arg);
        }
    }

    return {
        args: filteredArgs,
        outputFile,
        errorFile,
        appendOutput,
        appendError,
    };
}

function writeToFile(filePath, content, append) {
    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (append) {
            fs.appendFileSync(filePath, content);
        } else {
            fs.writeFileSync(filePath, content);
        }
    } catch (error) {
        throw error;
    }
}

function handlePipeline(commandLine) {
    const [cmd1Str, cmd2Str] = commandLine.split("|").map((s) => s.trim());

    const cmd1Args = parseArguments(cmd1Str);
    const cmd2Args = parseArguments(cmd2Str);

    const cmd1IsBuiltin = builtins.includes(cmd1Args[0]);
    const cmd2IsBuiltin = builtins.includes(cmd2Args[0]);

    if (cmd1IsBuiltin && cmd2IsBuiltin) {
        let output = executeBuiltin(cmd1Args);
        let finalOutput = "";

        if (cmd2Args[0] === "type") {
            const typeArg = cmd2Args[1];
            if (builtins.includes(typeArg)) {
                finalOutput = `${typeArg} is a shell builtin`;
            } else {
                const executablePath = findExecutable(typeArg);
                if (executablePath) {
                    finalOutput = `${typeArg} is ${executablePath}`;
                } else {
                    finalOutput = `${typeArg}: not found`;
                }
            }
        } else {
            finalOutput = output;
        }

        console.log(finalOutput);
        repl();
    } else if (cmd1IsBuiltin && !cmd2IsBuiltin) {
        const cmd2Path = findExecutable(cmd2Args[0]);
        if (!cmd2Path) {
            console.error(`${cmd2Args[0]}: command not found`);
            repl();
            return;
        }

        const cmd2 = spawn(cmd2Path, cmd2Args.slice(1), {
            stdio: ["pipe", "inherit", "inherit"],
            argv0: cmd2Args[0],
        });

        let output = executeBuiltin(cmd1Args);
        cmd2.stdin.write(output + "\n");
        cmd2.stdin.end();

        cmd2.on("close", () => {
            repl();
        });
    } else if (!cmd1IsBuiltin && cmd2IsBuiltin) {
        const cmd1Path = findExecutable(cmd1Args[0]);
        if (!cmd1Path) {
            console.error(`${cmd1Args[0]}: command not found`);
            repl();
            return;
        }

        if (cmd2Args[0] === "type") {
            const typeArg = cmd2Args[1];
            let output = "";
            if (builtins.includes(typeArg)) {
                output = `${typeArg} is a shell builtin`;
            } else {
                const executablePath = findExecutable(typeArg);
                if (executablePath) {
                    output = `${typeArg} is ${executablePath}`;
                } else {
                    output = `${typeArg}: not found`;
                }
            }

            const cmd1 = spawn(cmd1Path, cmd1Args.slice(1), {
                stdio: ["inherit", "pipe", "inherit"],
                argv0: cmd1Args[0],
            });

            cmd1.on("close", () => {
                console.log(output);
                repl();
            });
        } else {
            repl();
        }
    } else {
        const cmd1Path = findExecutable(cmd1Args[0]);
        const cmd2Path = findExecutable(cmd2Args[0]);

        if (!cmd1Path) {
            console.error(`${cmd1Args[0]}: command not found`);
            repl();
            return;
        }

        if (!cmd2Path) {
            console.error(`${cmd2Args[0]}: command not found`);
            repl();
            return;
        }

        const cmd1 = spawn(cmd1Path, cmd1Args.slice(1), {
            stdio: ["inherit", "pipe", "inherit"],
            argv0: cmd1Args[0],
        });

        const cmd2 = spawn(cmd2Path, cmd2Args.slice(1), {
            stdio: ["pipe", "inherit", "inherit"],
            argv0: cmd2Args[0],
        });

        cmd1.stdout.pipe(cmd2.stdin);

        cmd2.on("close", () => {
            repl();
        });
    }
}

function executeBuiltin(args) {
    const command = args[0];
    const cmdArgs = args.slice(1);

    if (command === "echo") {
        return cmdArgs.join(" ");
    } else if (command === "pwd") {
        return process.cwd();
    } else if (command === "type") {
        const typeArg = cmdArgs[0];
        if (builtins.includes(typeArg)) {
            return `${typeArg} is a shell builtin`;
        } else {
            const executablePath = findExecutable(typeArg);
            if (executablePath) {
                return `${typeArg} is ${executablePath}`;
            } else {
                return `${typeArg}: not found`;
            }
        }
    }
    return "";
}

const repl = () => {
    lastTabInput = "";
    tabCount = 0;

    rl.question("$ ", (answer) => {
        if (answer === "exit 0" || answer === "exit") {
            rl.close();
            process.exit(0);
        }

        const parsedArgs = parseArguments(answer);
        if (parsedArgs.length === 0) {
            repl();
            return;
        }

        const command = parsedArgs[0];
        const { args, outputFile, errorFile, appendOutput, appendError } =
            parseRedirection(parsedArgs.slice(1));

        let output = "";
        let shouldRedirectStdout = outputFile !== null;
        let shouldRedirectStderr = errorFile !== null;

        if (answer.includes("|")) {
            handlePipeline(answer);
            return;
        }

        if (command === "echo") {
            output = args.join(" ");

            if (shouldRedirectStderr) {
                try {
                    writeToFile(errorFile, "", appendError);
                } catch (error) {
                    console.error(`echo: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    writeToFile(outputFile, output + "\n", appendOutput);
                } catch (error) {
                    const errorMsg = `echo: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            writeToFile(
                                errorFile,
                                errorMsg + "\n",
                                appendError,
                            );
                        } catch (writeError) {
                            console.error(errorMsg);
                        }
                    } else {
                        console.error(errorMsg);
                    }
                }
            } else {
                console.log(output);
            }
        } else if (command === "type") {
            const typeArg = args.join(" ");
            if (builtins.includes(typeArg)) {
                output = `${typeArg} is a shell builtin`;
            } else {
                const executablePath = findExecutable(typeArg);
                if (executablePath) {
                    output = `${typeArg} is ${executablePath}`;
                } else {
                    output = `${typeArg}: not found`;
                }
            }

            if (shouldRedirectStderr) {
                try {
                    writeToFile(errorFile, "", appendError);
                } catch (error) {
                    console.error(`type: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    writeToFile(outputFile, output + "\n", appendOutput);
                } catch (error) {
                    const errorMsg = `type: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            writeToFile(
                                errorFile,
                                errorMsg + "\n",
                                appendError,
                            );
                        } catch (writeError) {
                            console.error(errorMsg);
                        }
                    } else {
                        console.error(errorMsg);
                    }
                }
            } else {
                console.log(output);
            }
        } else if (command === "pwd") {
            output = process.cwd();

            if (shouldRedirectStderr) {
                try {
                    writeToFile(errorFile, "", appendError);
                } catch (error) {
                    console.error(`pwd: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    writeToFile(outputFile, output + "\n", appendOutput);
                } catch (error) {
                    const errorMsg = `pwd: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            writeToFile(
                                errorFile,
                                errorMsg + "\n",
                                appendError,
                            );
                        } catch (writeError) {
                            console.error(errorMsg);
                        }
                    } else {
                        console.error(errorMsg);
                    }
                }
            } else {
                console.log(output);
            }
        } else if (command === "cd") {
            const path = args[0] || process.env.HOME;

            if (shouldRedirectStderr) {
                try {
                    writeToFile(errorFile, "", appendError);
                } catch (error) {
                    console.error(`cd: ${error.message}`);
                }
            }

            if (path === "~") {
                process.chdir(process.env.HOME);
            } else {
                try {
                    process.chdir(path);
                } catch (error) {
                    const errorMsg = `cd: ${path}: No such file or directory`;
                    if (shouldRedirectStderr) {
                        try {
                            writeToFile(
                                errorFile,
                                errorMsg + "\n",
                                appendError,
                            );
                        } catch (writeError) {
                            console.error(errorMsg);
                        }
                    } else {
                        console.error(errorMsg);
                    }
                }
            }
        } else {
            const executablePath = findExecutable(command);
            if (executablePath) {
                if (shouldRedirectStdout || shouldRedirectStderr) {
                    try {
                        if (shouldRedirectStdout) {
                            const dir = path.dirname(outputFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                        }
                        if (shouldRedirectStderr) {
                            const dir = path.dirname(errorFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                        }

                        const result = spawnSync(executablePath, args, {
                            encoding: "utf-8",
                            argv0: command,
                        });

                        if (shouldRedirectStdout) {
                            if (appendOutput) {
                                fs.appendFileSync(
                                    outputFile,
                                    result.stdout || "",
                                );
                            } else {
                                fs.writeFileSync(
                                    outputFile,
                                    result.stdout || "",
                                );
                            }
                        } else if (result.stdout) {
                            process.stdout.write(result.stdout);
                        }

                        if (shouldRedirectStderr) {
                            if (appendError) {
                                fs.appendFileSync(
                                    errorFile,
                                    result.stderr || "",
                                );
                            } else {
                                fs.writeFileSync(
                                    errorFile,
                                    result.stderr || "",
                                );
                            }
                        } else if (result.stderr) {
                            process.stderr.write(result.stderr);
                        }
                    } catch (error) {
                        const errorMsg = `${command}: ${error.message}`;
                        if (shouldRedirectStderr) {
                            try {
                                writeToFile(
                                    errorFile,
                                    errorMsg + "\n",
                                    appendError,
                                );
                            } catch (writeError) {
                                console.error(errorMsg);
                            }
                        } else {
                            console.error(errorMsg);
                        }
                    }
                } else {
                    spawnSync(executablePath, args, {
                        encoding: "utf-8",
                        stdio: "inherit",
                        argv0: command,
                    });
                }
            } else {
                const errorMsg = `${answer}: command not found`;
                if (shouldRedirectStderr) {
                    try {
                        writeToFile(errorFile, errorMsg + "\n", appendError);
                    } catch (error) {
                        console.error(errorMsg);
                    }
                } else {
                    console.error(errorMsg);
                }
            }
        }

        repl();
    });
};

repl();
