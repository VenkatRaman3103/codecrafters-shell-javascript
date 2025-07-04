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
    let filteredArgs = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === ">" || arg === "1>") {
            if (i + 1 < args.length) {
                outputFile = args[i + 1];
                i++;
            }
        } else if (arg.startsWith("1>")) {
            outputFile = arg.slice(2);
        } else if (arg.startsWith(">")) {
            outputFile = arg.slice(1);
        } else {
            filteredArgs.push(arg);
        }
    }

    return { args: filteredArgs, outputFile };
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
        const { args, outputFile } = parseRedirection(parsedArgs.slice(1));

        let output = "";
        let shouldRedirect = outputFile !== null;

        if (command === "echo") {
            output = args.join(" ");
            if (shouldRedirect) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    console.log(`echo: ${error.message}`);
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

            if (shouldRedirect) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    console.log(`type: ${error.message}`);
                }
            } else {
                console.log(output);
            }
        } else if (command === "pwd") {
            output = process.cwd();
            if (shouldRedirect) {
                try {
                    const dir = path.dirname(outputFile);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(outputFile, output + "\n");
                } catch (error) {
                    console.log(`pwd: ${error.message}`);
                }
            } else {
                console.log(output);
            }
        } else if (command === "cd") {
            const path = args[0] || process.env.HOME;
            if (path === "~") {
                process.chdir(process.env.HOME);
            } else {
                try {
                    process.chdir(path);
                } catch (error) {
                    console.log(`cd: ${path}: No such file or directory`);
                }
            }
        } else {
            const executablePath = findExecutable(command);
            if (executablePath) {
                if (shouldRedirect) {
                    try {
                        const dir = path.dirname(outputFile);
                        if (!fs.existsSync(dir)) {
                            fs.mkdirSync(dir, { recursive: true });
                        }

                        const result = spawnSync(executablePath, args, {
                            encoding: "utf-8",
                            argv0: command,
                        });

                        if (result.stdout) {
                            fs.writeFileSync(outputFile, result.stdout);
                        }

                        if (result.stderr) {
                            process.stderr.write(result.stderr);
                        }
                    } catch (error) {
                        console.log(`${command}: ${error.message}`);
                    }
                } else {
                    spawnSync(executablePath, args, {
                        encoding: "utf-8",
                        stdio: "inherit",
                        argv0: command,
                    });
                }
            } else {
                console.log(`${answer}: command not found`);
            }
        }

        repl();
    });
};

repl();
