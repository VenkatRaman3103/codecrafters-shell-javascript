import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const repl = () => {
    rl.question("$ ", (answer) => {
        console.log(`${answer}: command not found`);
        repl();
    });
};

repl();
