(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const c = window.SHILOH_CONFIG || {};
  const notice = (message, isError = false) => {
    $('loginNotice').hidden = false;
    $('loginNotice').className = 'status ' + (isError ? 'error' : 'success');
    $('loginNotice').textContent = message;
  };
  const valid = !!(window.supabase && c.supabaseUrl?.startsWith('https://') &&
    c.supabaseAnonKey && !c.supabaseAnonKey.includes('YOUR_'));
  if (!valid) {
    notice('Sign-in is unavailable because the calendar is not fully configured. Please contact the calendar owner.', true);
    $('sendLinkBtn').disabled = true;
    return;
  }
  const db = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey);
  let checking = false;
  const checkAccess = async () => {
    if (checking) return;
    checking = true;
    try {
      const { data: { session }, error: sessionError } = await db.auth.getSession();
      if (sessionError || !session) return;
      const { data: approved, error } = await db.rpc('calendar_can_view');
      if (!error && approved === true) {
        location.replace('/');
        return;
      }
      await db.auth.signOut();
      notice('This email does not have access to the Ministerium calendar. Please contact the calendar owner.', true);
    } finally {
      checking = false;
    }
  };
  db.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') setTimeout(checkAccess, 0);
  });
  checkAccess();

  $('linkLogin').onsubmit = async event => {
    event.preventDefault();
    const button = $('sendLinkBtn');
    button.disabled = true;
    const email = $('memberEmail').value.trim().toLowerCase();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: location.origin + '/admin.html'
      }
    });
    button.disabled = false;
    if (error) {
      const msg = String(error.message || '');
      const code = String(error.code || '').toLowerCase();
      if (code === 'over_email_send_rate_limit' || error.status === 429 || /rate limit/i.test(msg)) {
        notice('Supabase email limit reached. Try again after the limit resets. For dependable member access, a custom email provider will be needed.', true);
      } else if (code === 'email_address_not_authorized' || /not authorized/i.test(msg)) {
        notice('Supabase cannot send email to this address using the current email settings. Contact the calendar owner.', true);
      } else if (/signups not allowed for otp/i.test(msg)) {
        notice('This email must first be created or invited under Supabase Authentication → Users. Contact the calendar owner.', true);
      } else {
        notice('The sign-in email could not be sent (' + (code || msg || 'unknown error') + '). Check Supabase Authentication logs.', true);
      }
      return;
    }
    notice('If your account is registered, a secure sign-in link has been requested. Check your email and spam folder.');
  };
})();