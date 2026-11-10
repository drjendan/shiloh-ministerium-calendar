(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const c = window.SHILOH_CONFIG || {};
  const valid = !!(window.supabase && c.supabaseUrl?.startsWith('https://') && c.supabaseAnonKey && !c.supabaseAnonKey.includes('YOUR_'));
  const notice = (msg,error=false) => {
    $('loginNotice').hidden=false;
    $('loginNotice').className='status '+(error?'error':'success');
    $('loginNotice').textContent=msg;
  };
  if (!valid) {notice('Sign-in is temporarily unavailable. Please contact the calendar administrator.',true);$('signInBtn').disabled=true;return;}
  const db=window.supabase.createClient(c.supabaseUrl,c.supabaseAnonKey);
  const params=new URLSearchParams(location.search);
  const isRecovery=params.get('type')==='recovery' || location.hash.includes('type=recovery');
  let recoveryMode=isRecovery;

  function showRecovery() {
    recoveryMode=true;
    $('passwordLogin').hidden=true;
    $('forgotPassword').hidden=true;
    $('resetForm').hidden=true;
    $('newPasswordForm').hidden=false;
    $('loginTitle').textContent='Set Your Password';
  }

  if (isRecovery) showRecovery();

  async function verifyMembership() {
    const {data,error}=await db.rpc('calendar_can_view');
    return !error && data===true;
  }

  async function signedInRedirect() {
    const member=await verifyMembership();
    if (!member) {
      await db.auth.signOut();
      notice('This account has not been approved for the Ministerium calendar. Please contact the calendar owner.',true);
      return;
    }
    location.replace('/');
  }

  db.auth.onAuthStateChange((event) => {
    if (event==='PASSWORD_RECOVERY') {
      showRecovery();
    }
  });

  if (!recoveryMode) {
    db.auth.getSession().then(async ({data}) => {
      if (data.session && !recoveryMode) await signedInRedirect();
    });
  }

  $('passwordLogin').onsubmit=async ev=>{
    ev.preventDefault();
    $('signInBtn').disabled=true;
    const email=$('adminEmail').value.trim().toLowerCase(), password=$('adminPassword').value;
    const {error}=await db.auth.signInWithPassword({email,password});
    $('signInBtn').disabled=false;
    if(error){ notice('Unable to sign in. Check your email and password.',true); return;}
    await signedInRedirect();
  };

  $('forgotPassword').onclick=()=>{
    $('passwordLogin').hidden=true;
    $('forgotPassword').hidden=true;
    $('resetForm').hidden=false;
    $('resetEmail').value=$('adminEmail').value;
    $('loginTitle').textContent='Set or Reset Password';
  };

  $('cancelReset').onclick=()=>{
    $('resetForm').hidden=true;
    $('passwordLogin').hidden=false;
    $('forgotPassword').hidden=false;
    $('loginTitle').textContent='Member Sign In';
    $('loginNotice').hidden=true;
  };

  $('resetForm').onsubmit=async ev=>{
    ev.preventDefault();
    $('sendReset').disabled=true;
    const {error}=await db.auth.resetPasswordForEmail($('resetEmail').value.trim().toLowerCase(),{
      redirectTo:location.origin+'/admin.html'
    });
    $('sendReset').disabled=false;
    if(error) {notice('Could not send the password email. Please contact an administrator if the problem continues.',true);return;}
    notice('If your account is registered, a password setup link has been sent to your email.');
  };

  $('newPasswordForm').onsubmit=async ev=>{
    ev.preventDefault();
    if($('newPassword').value!==$('confirmPassword').value) {notice('Passwords do not match.',true);return;}
    $('savePassword').disabled=true;
    const {error}=await db.auth.updateUser({password:$('newPassword').value});
    $('savePassword').disabled=false;
    if(error){ notice('Unable to save your password: '+error.message,true);return;}
    notice('Password saved. Your account will now be checked for calendar access.');
    const authorized=await verifyMembership();
    if(authorized) location.replace('/');
    else {
      await db.auth.signOut();
      notice('Password saved, but this email has not been approved to view the calendar. Contact the calendar owner.',true);
      $('newPasswordForm').hidden=true;
    }
  };
})();