import readline from "readline";
import fs from "fs";
import { spawnSync } from "child_process";
import path from "path";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const builtins = ["type", "echo", "exit", "pwd", "cd"];

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
    let filteredArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === ">" || arg === "1>") {
            if (i + 1 < args.length) {
                outputFile = args[i + 1];
                i++;
            }
        } else if (arg === "2>") {
            if (i + 1 < args.length) {
                errorFile = args[i + 1];
                i++;
            }
        } else if (arg.startsWith("1>")) {
            outputFile = arg.slice(2);
        } else if (arg.startsWith(">")) {
            outputFile = arg.slice(1);
        } else if (arg.startsWith("2>")) {
            errorFile = arg.slice(2);
        } else {
            filteredArgs.push(arg);
        }
    }

    return { args: filteredArgs, outputFile, errorFile };
}

const repl = () => {
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
        const { args, outputFile, errorFile } = parseRedirection(
            parsedArgs.slice(1),
        );

        let output = "";
        let shouldRedirectStdout = outputFile !== null;
        let shouldRedirectStderr = errorFile !== null;

        if (command === "echo") {
            output = args.join(" ");

            if (shouldRedirectStderr) {
                try {
                    const dir = path.dirname(errorFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(errorFile, "");
                } catch (error) {
                    console.error(`echo: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    const errorMsg = `echo: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            const dir = path.dirname(errorFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            fs.writeFileSync(errorFile, errorMsg + "\n");
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
                    const dir = path.dirname(errorFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(errorFile, "");
                } catch (error) {
                    console.error(`type: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    const errorMsg = `type: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            const dir = path.dirname(errorFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            fs.writeFileSync(errorFile, errorMsg + "\n");
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
                    const dir = path.dirname(errorFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(errorFile, "");
                } catch (error) {
                    console.error(`pwd: ${error.message}`);
                }
            }

            if (shouldRedirectStdout) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    const errorMsg = `pwd: ${error.message}`;
                    if (shouldRedirectStderr) {
                        try {
                            const dir = path.dirname(errorFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            fs.writeFileSync(errorFile, errorMsg + "\n");
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
                    const dir = path.dirname(errorFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(errorFile, "");
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
                            const dir = path.dirname(errorFile);
                            if (!fs.existsSync(dir)) {
                                fs.mkdirSync(dir, { recursive: true });
                            }
                            fs.writeFileSync(errorFile, errorMsg + "\n");
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

                        if (result.stdout) {
                            if (shouldRedirectStdout) {
                                fs.writeFileSync(outputFile, result.stdout);
                            } else {
                                process.stdout.write(result.stdout);
                            }
                        }

                        if (result.stderr) {
                            if (shouldRedirectStderr) {
                                fs.writeFileSync(errorFile, result.stderr);
                            } else {
                                process.stderr.write(result.stderr);
                            }
                        }
                    } catch (error) {
                        const errorMsg = `${command}: ${error.message}`;
                        if (shouldRedirectStderr) {
                            try {
                                const dir = path.dirname(errorFile);
                                if (!fs.existsSync(dir)) {
                                    fs.mkdirSync(dir, { recursive: true });
                                }
                                fs.writeFileSync(errorFile, errorMsg + "\n");
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
                        const dir = path.dirname(errorFile);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }
                        fs.writeFileSync(errorFile, errorMsg + "\n");
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
