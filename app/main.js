import readline from "readline";
import fs from "fs";
import { spawnSync } from "child_process";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const builtins = ["type", "echo", "exit", "pwd"];

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

const repl = () => {
    rl.question("$ ", (answer) => {
        if (answer == "exit 0") {
            rl.close();
            process.exit(0);
        }
        const line = answer.split(" ");
        const command = line[0];
        const args = line.slice(1);

        if (command == "echo") {
            console.log(args.join(" "));
        } else if (command == "type") {
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
        } else if (command == "pwd") {
            console.log(process.cwd());
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
