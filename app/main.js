import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Uncomment this block to pass the first stage
rl.question("$ ", (answer) => {
    rl.close();
});
