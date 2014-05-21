(function () {
  var feedback = document.getElementById('feedback')
    , message = document.getElementById('message')
    , output = document.getElementById('output')
    , password = document.getElementById('password')
    , status = document.getElementById('status')
    , username = document.getElementById('username');

  //
  // Create a new Primus instance specifying that we want to open the
  // connection manually.
  //
  var primus = new Primus({ manual: true });

  //
  // For convenience we use the private event `outgoing::url` to append the
  // authorization token in the query string of our connection URL.
  //
  primus.on('outgoing::url', function connectionURL(url) {
    url.query = 'token=' + (localStorage.getItem('token') || '');
  });

  primus.on('open', function open() {
    status.textContent = 'connected';
  });

  primus.on('close', function close() {
    status.textContent = 'disconnected';
  });

  primus.on('data', function received(data) {
    var li = document.createElement('li');
    output.appendChild(li).textContent = data;
  });

  document.getElementById('open').onclick = function open() {
    //
    // Open a new connection with the server.
    // We use `primus.end()` before `primus.open()` to ensure that the
    // connection is closed before we try to open a new one.
    //
    primus.end().open();
  };

  document.getElementById('echo').onsubmit = function write(e) {
    if (e && e.preventDefault) e.preventDefault();

    //
    // Write the message to the server.
    //
    primus.write(message.value);
    message.value = '';
  };

  document.getElementById('login').onsubmit = function login(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (password.value === '' || username.value === '') return;

    //
    // Send an Ajax request to get an authorization token.
    //
    superagent.post('/login')
      .send({ password: password.value, username: username.value })
      .end(function (res) {
        password.value = username.value = '';
        feedback.classList.remove('hidden');

        if (res.ok) {
          feedback.textContent = 'Authorization token received, try to connect';
          feedback.classList.remove('alert-danger');
          feedback.classList.add('alert-success');

          //
          // Save the token in localStorage.
          //
          return localStorage.setItem('token', res.body.token);
        }

        feedback.textContent = res.body.message;
        feedback.classList.remove('alert-success');
        feedback.classList.add('alert-danger');
      });
  };
})();
