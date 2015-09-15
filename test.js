var critical = require('./');

critical.generate({
    inline: true,
    base: 'test/fixtures',
    src: 'index.html',
    dest: 'index-critical.html',
    width: 1300,
    height: 900
});
