/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

var url_params = get_url_params(['account_email', 'frame_id', 'message', 'question', 'parent_tab_id', 'message_id', 'is_outgoing', 'sender_email']);
url_params.is_outgoing = Boolean(Number(url_params.is_outgoing || ''));

var l = {
  cant_open: 'Could not open this message with CryptUP.\n\n',
  encrypted_correctly_file_bug: 'It\'s correctly encrypted for you. Please file a bug report if you see this on multiple messages. ',
  single_sender: 'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. ',
  account_info_outdated: 'Some of your account information is incorrect. Update it to prevent future errors. ',
  wrong_pubkey_used: 'It looks like it was encrypted for someone else. ', //todo - suggest adding key?
  ask_resend: 'Please ask them to send a new message.',
  receivers_hidden: 'We cannot tell if the message was encrypted correctly for you. ',
  bad_format: 'Message is either badly formatted or not compatible with CryptUP. ',
  no_private_key: 'No private key to decrypt this message. Try reloading the page. ',
  refresh_page: 'Refresh page to see more information.',
  question_decryt_prompt: 'To decrypt the message, answer: ',
  connection_error: 'Could not connect to Gmail to open the message, please refresh the page to try again. ',
  dont_know_how_open: 'Please submit a bug report, and mention what software was used to send this message to you. We usually fix similar incompatibilities within one week. ',
  enter_passphrase: 'Enter passphrase',
  to_open_message: 'to open this message.',
  write_me: 'Please write me at tom@cryptup.org so that I can fix it. I respond very promptly. ',
  refresh_window: 'Please refresh your Gmail window to read encrypted messages. ',
  update_chrome_settings: 'Need to update chrome settings to view encrypted messages. ',
  not_properly_set_up: 'CryptUP is not properly set up to decrypt messages. ',
};

db_open(function(db) {

  var ready_attachmments = [];
  var height_history = [];
  var message_fetched_from_api = false;
  var passphrase_interval = undefined;
  var missing_or_wrong_passprases = {};
  var can_read_emails = undefined;

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    render_error(l.update_chrome_settings + '<a href="#" class="review_settings">Review Settings</a>', null, function() {
      $('.review_settings').click(function() {
        chrome_message_send(null, 'settings', {
          account_email: url_params.account_email,
          page: '/chrome/texts/chrome_content_settings.htm',
        });
      });
    });
    return;
  }

  increment_metric('view');

  function send_resize_message() {
    var new_height = $('#pgp_block').height() + 40;

    function is_infinite_resize_loop() {
      height_history.push(new_height);
      var len = height_history.length;
      if(len < 4) {
        return false;
      }
      if(height_history[len - 1] === height_history[len - 3] && height_history[len - 2] === height_history[len - 4] && height_history[len - 1] !== height_history[len - 2]) {
        console.log('pgp_block.js: repetitive resize loop prevented'); //got repetitive, eg [70, 80, 200, 250, 200, 250]
        new_height = Math.max(height_history[len - 1], height_history[len - 2]);
      }
    }

    if(!is_infinite_resize_loop()) {
      chrome_message_send(url_params.parent_tab_id, 'set_css', {
        selector: 'iframe#' + url_params.frame_id,
        css: {
          height: new_height,
        }
      });
    }
  }

  function format_for_contenteditable(text_or_html) {
    return inner_text(text_or_html.replace(/<br ?\/?>[\r?\n]/gm, '<br>')).replace(/\n/g, '<br>').replace(/ {2,}/g, function(spaces) {
      return '&nbsp;'.repeat(spaces.length);
    });
  }

  function render_content(content, is_error, callback) {
    account_storage_get(url_params.account_email, ['successfully_received_at_leat_one_message'], function(storage) {
      if(!is_error && !url_params.is_outgoing) { //successfully opened incoming message
        account_storage_set(url_params.account_email, {
          successfully_received_at_leat_one_message: true
        });
      }
      $('#pgp_block').html(is_error ? content : format_for_contenteditable(content));
      if(callback) {
        callback();
      }
      setTimeout(function() {
        $(window).resize(prevent(spree(), send_resize_message));
      }, 1000);
      send_resize_message();
    });
  }

  function button_html(text, add_classes) {
    return '<br><div class="button long ' + add_classes + '" style="margin:30px 0;" target="cryptup">' + text + '</div>';
  }

  function armored_message_as_html(raw_message_substitute) {
    if(raw_message_substitute || url_params.message) {
      return '<div class="raw_pgp_block">' + (raw_message_substitute || url_params.message).replace(/\n/g, '<br>') + '</div>';
    }
    return '';
  }

  function set_frame_color(c) {
    if(c === 'red') {
      $('body').removeClass('pgp_secure').removeClass('pgp_neutral').addClass('pgp_insecure');
    } else if(c === 'green') {
      $('body').removeClass('pgp_neutral').removeClass('pgp_insecure').addClass('pgp_secure');
    } else {
      $('body').removeClass('pgp_secure').removeClass('pgp_insecure').addClass('pgp_neutral');
    }
  }

  function render_error(error_box_content, raw_message_substitute, callback) {
    set_frame_color('red');
    render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true, function() {
      $('.button.settings_keyserver').click(function() {
        chrome_message_send(null, 'settings', {
          account_email: url_params.account_email,
          page: '/chrome/settings/modules/keyserver.htm',
        });
      });
      $('.button.settings').click(function() {
        chrome_message_send(null, 'settings', {
          account_email: url_params.account_email,
        });
      });
      if(callback) {
        callback();
      }
    });
  }

  function handle_private_key_mismatch(account_email, message) { //todo - make it work for multiple stored keys
    var msg_diagnosis = check_pubkeys_message(account_email, message);
    if(msg_diagnosis.found_match) {
      render_error(l.cant_open + l.encrypted_correctly_file_bug);
    } else {
      if(msg_diagnosis.receivers === 1) {
        render_error(l.cant_open + l.single_sender + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
      } else {
        check_pubkeys_keyserver(account_email, function(ksrv_diagnosis) {
          if(!ksrv_diagnosis) {
            render_error(l.cant_open + l.refresh_page);
          } else {
            if(msg_diagnosis.receivers) {
              if(ksrv_diagnosis.has_pubkey_mismatch) {
                render_error(l.cant_open + l.account_info_outdated + button_html('review outdated information', 'green settings_keyserver'));
              } else {
                render_error(l.cant_open + l.wrong_pubkey_used + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
              }
            } else {
              if(ksrv_diagnosis.has_pubkey_mismatch) {
                render_error(l.cant_open + l.receivers_hidden + l.account_info_outdated + button_html('review outdated information', 'green settings_keyserver'));
              } else {
                render_error(l.cant_open + l.receivers_hidden + l.ask_resend + button_html('account settings', 'gray2 settings_keyserver'));
              }
            }
          }
        });
      }
    }
  }

  function render_inner_attachments(attachments) {
    $('#pgp_block').append('<div id="attachments"></div>');
    ready_attachmments = attachments;
    $.each(ready_attachmments, function(i, attachment) {
      $('#attachments').append('<div class="attachment" index="' + i + '"><b>' + attachment.name + '</b>&nbsp;&nbsp;&nbsp;(' + number_format(Math.ceil(attachment.size / 1024)) + 'KB, ' + attachment.type + ')</div>');
    });
    send_resize_message();
    $('div.attachment').click(prevent(doubleclick(), function(self) {
      var attachment = ready_attachmments[$(self).attr('index')];
      download_file(attachment.name, attachment.type, str_to_uint8(attachment.data));
    }));
  }

  function render_pgp_signature_check_result(signature) {
    if(signature) {
      $('#pgp_signature > .cursive > span').text(signature.contact ? signature.contact.name || url_params.sender_email : url_params.sender_email);
      if(signature.signer && !signature.contact) {
        $('#pgp_signature').addClass('neutral');
        $('#pgp_signature > .result').text('cannot verify signature');
      } else if(signature.match && signature.signer && signature.contact) {
        $('#pgp_signature').addClass('good');
        $('#pgp_signature > .result').text('matching signature');
      } else {
        $('#pgp_signature').addClass('bad');
        $('#pgp_signature > .result').text('signature does not match');
        set_frame_color('red');
      }
      $('#pgp_signature').css('block');
    }
  }

  function decide_decrypted_content_formatting_and_render(decrypted_content, is_encrypted, signature) {
    set_frame_color(is_encrypted ? 'green' : 'gray');
    render_pgp_signature_check_result(signature);
    if(!could_be_mime_message(decrypted_content)) {
      render_content(format_mime_plaintext_to_display(decrypted_content, url_params.message));
    } else {
      $('#pgp_block').text('Formatting...');
      parse_mime_message(decrypted_content, function(success, result) {
        render_content(format_mime_plaintext_to_display(result.text || result.html || decrypted_content, url_params.message), false, function() {
          if(result.attachments.length) {
            render_inner_attachments(result.attachments);
          }
        });
      });
    }
  }

  function decrypt_and_render(optional_password) {
    decrypt(db, url_params.account_email, url_params.message, optional_password, function(result) {
      if(result.success) {
        if(result.success && result.signature && result.signature.contact && !result.signature.match && can_read_emails && message_fetched_from_api !== 'raw') {
          console.log('re-fetching message ' + url_params.message_id + ' from api because failed signature check: ' + ((!message_fetched_from_api) ? 'full' : 'raw'));
          initialize(true);
        } else {
          decide_decrypted_content_formatting_and_render(result.content.data, result.encrypted, result.signature);
        }
      } else if(result.format_error) {
        render_error(l.bad_format + '\n\n' + result.format_error);
      } else if(result.missing_passphrases.length) {
        render_passphrase_prompt(result.missing_passphrases);
      } else if(!result.counts.potentially_matching_keys && !private_storage_get('local', url_params.account_email, 'master_private_key', url_params.parent_tab_id)) {
        render_error(l.not_properly_set_up + button_html('cryptup settings', 'green settings'));
      } else if(result.counts.potentially_matching_keys === result.counts.attempts && result.counts.key_mismatch === result.counts.attempts) {
        if(url_params.question && !optional_password) {
          render_password_prompt();
        } else {
          handle_private_key_mismatch(url_params.account_email, result.message);
        }
      } else if(result.counts.wrong_password) {
        alert('Incorrect answer, please try again');
        render_password_prompt();
      } else if(result.counts.errors) {
        render_error(l.cant_open + l.bad_format + '\n\n' + '<em>' + result.errors.join('<br>') + '</em>');
      } else {
        delete result.message;
        render_error(l.cant_open + l.write_me + '\n\nDiagnostic info: "' + JSON.stringify(result) + '"');
      }
    });
  }

  function render_passphrase_prompt(missing_or_wrong_passphrase_key_longids) {
    missing_or_wrong_passprases = {};
    $.each(missing_or_wrong_passphrase_key_longids, function(i, longid) {
      missing_or_wrong_passprases[longid] = get_passphrase(url_params.account_email, longid);
    });
    render_error('<a href="#" class="enter_passphrase">' + l.enter_passphrase + '</a> ' + l.to_open_message, undefined, function() {
      clearInterval(passphrase_interval);
      passphrase_interval = setInterval(check_passphrase_changed, 1000);
      $('.enter_passphrase').click(prevent(doubleclick(), function() {
        chrome_message_send(url_params.parent_tab_id, 'passphrase_dialog', {
          type: 'message',
          longids: missing_or_wrong_passphrase_key_longids,
        });
        clearInterval(passphrase_interval);
        passphrase_interval = setInterval(check_passphrase_changed, 250);
      }));
    });
  }

  function render_password_prompt() {
    var prompt = '<p>' + l.question_decryt_prompt + '"' + url_params.question + '" </p>';
    prompt += '<p><input id="answer" placeholder="Answer"></p><p><div class="button green long decrypt">decrypt message</div></p>';
    prompt += armored_message_as_html();
    render_content(prompt, true, function() {
      $('.button.decrypt').click(prevent(doubleclick(), function(self) {
        $(self).html('Opening');
        setTimeout(function() {
          decrypt_and_render($('#answer').val());
        }, 50);
      }));
    });
  }

  function check_passphrase_changed() {
    $.each(missing_or_wrong_passprases, function(i, longid) {
      if(missing_or_wrong_passprases[longid] !== get_passphrase(url_params.account_email, longid)) {
        missing_or_wrong_passprases = {};
        clearInterval(passphrase_interval);
        decrypt_and_render();
        return false;
      }
    });
  }

  function initialize(force_pull_message_from_api) {
    if(url_params.message && !force_pull_message_from_api) { // ascii armored message supplied
      $('#pgp_block').text('Decrypting...');
      decrypt_and_render();
    } else { // need to fetch the message from gmail api
      if(can_read_emails) {
        $('#pgp_block').text('Retrieving message...');
        var format = (!message_fetched_from_api) ? 'full' : 'raw';
        extract_armored_message_using_gmail_api(url_params.account_email, url_params.message_id, format, function(message_raw) {
          $('#pgp_block').text('Decrypting...');
          url_params.message = message_raw;
          message_fetched_from_api = format;
          decrypt_and_render();
        }, function(error_type, url_formatted_data_block) {
          if(error_type === 'format') {
            if(url_formatted_data_block.indexOf('-----END PGP PUBLIC KEY BLOCK-----') !== -1) {
              window.location = 'pgp_pubkey.htm?account_email' + encodeURIComponent(url_params.account_email) + '&armored_pubkey=' + encodeURIComponent(url_formatted_data_block) + '&parent_tab_id=' + encodeURIComponent(url_params.parent_tab_id) + '&frame_id=' + encodeURIComponent(url_params.frame_id);
            } else {
              render_error(l.cant_open + l.dont_know_how_open, url_formatted_data_block);
            }
          } else if(error_type === 'connection') {
            render_error(l.connection_error, url_formatted_data_block);
          } else {
            alert('Unknown error type: ' + error_type);
          }
        });
      } else { // gmail message read auth not allowed
        $('#pgp_block').html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
        $('.auth_settings').click(function() {
          chrome_message_send(null, 'settings', {
            account_email: url_params.account_email,
            page: '/chrome/settings/modules/auth_denied.htm',
          });
        });
      }
    }
  }

  account_storage_get(url_params.account_email, ['setup_done', 'google_token_scopes'], function(storage) {
    can_read_emails = (typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
    if(storage.setup_done) {
      initialize();
    } else {
      render_error(l.refresh_window, url_params.message || '');
    }
  });
});
