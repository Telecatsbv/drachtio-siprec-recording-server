const test = require('tape').test ;

// hack: for some reason tape is hanging after last test...need to figure out and fix
test('end tests', (t) => {
  t.pass('tests ended');
  t.end();
  process.exit(0);
});
