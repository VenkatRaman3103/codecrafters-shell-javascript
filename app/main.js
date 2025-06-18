import readline from "readline";
import fs from "fs";
import { spawnSync } from "child_process";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const builtins = ["type", "echo", "exit", "pwd", "cd"];

const findExecutable = (command) => {
    const path_dirs = process.env.PATH.split(":");
    for (let dir of path_dirs) {
        const filePath = `${dir}/${command}`;
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return filePath;
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
        const args = parsedArgs.slice(1);

        if (command === "echo") {
            console.log(args.join(" "));
        } else if (command === "type") {
            const typeArg = args.join(" ");
            if (builtins.includes(typeArg)) {
                console.log(`${typeArg} is a shell builtin`);
            } else {
                const executablePath = findExecutable(typeArg);
                if (executablePath) {
                    console.log(`${typeArg} is ${executablePath}`);
                } else {
                    console.log(`${typeArg}: not found`);
                }
            }
        } else if (command === "pwd") {
            console.log(process.cwd());
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
                spawnSync(executablePath, args, {
                    encoding: "utf-8",
                    stdio: "inherit",
                    argv0: command,
                });
            } else {
                console.log(`${answer}: command not found`);
            }
        }

        repl();
    });
};

repl();
