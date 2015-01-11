var plan = require('flightplan');

var appName = 'node-app';
var username = 'deploy';

var tmpDir = appName+'-' + new Date().getTime();

plan.target('production', [
  {
    host: '188.226.246.135',
    username: username,
    agent: process.env.SSH_AUTH_SOCK
  }
]);

plan.local(function(local) {
  local.log('Run build');
  local.exec('gulp build');

  local.log('Copy files to remote hosts');
  var filesToCopy = local.exec('find dist -type f -print0', {silent: true});
  // rsync files to all the destination's hosts
  local.transfer(filesToCopy, '/tmp/' + tmpDir);
});

// run commands on remote hosts (destinations)
plan.remote(function(remote) {
  remote.log('Move folder to root');
  remote.exec('cp -R /tmp/' + tmpDir + '/dist/*' + ' /var/www/iuriikozuliak.com/public_html');
  remote.rm('-rf /tmp/' + tmpDir);
});
