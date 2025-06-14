import readline from "readline";
import fs from "fs";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const builtins = ["type", "echo", "exit"];

const repl = () => {
    rl.question("$ ", (answer) => {
        if (answer == "exit 0") {
            rl.close();
            process.exit(0);
        }
        const line = answer.split(" ");
        const command = line[0];
        const args = line.slice(1).join(" ");

        if (command == "echo") {
            console.log(args);
        } else if (command == "type") {
            if (builtins.includes(args)) {
                console.log(`${args} is a shell builtin`);
            } else {
                const path_dirs = process.env.PATH.split(":");
                let found = false;
                for (let dir of path_dirs) {
                    const filePath = `${dir}/${args}`;
                    if (
                        fs.existsSync(filePath) &&
                        fs.statSync(filePath).isFile()
                    ) {
                        console.log(`${args} is ${filePath}`);
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    console.log(`${args}: not found`);
                }
            }
        } else {
            console.log(`${answer}: command not found`);
        }
        repl();
    });
};
repl();
