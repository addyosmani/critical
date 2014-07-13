var critical=require('./index');
critical.generate({
    base: 'fixture/',
    src: 'index.html',
    width: 320,
    height: 480
}, function (err, output) {
    // You now have critical-path CSS
    // Works with and without dest specified
console.log(err, output);
});