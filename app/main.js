import readline from "readline";

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
                console.log(`${args}: not found`);
            }
        } else {
            console.log(`${answer}: command not found`);
        }

        repl();
    });
};

repl();
