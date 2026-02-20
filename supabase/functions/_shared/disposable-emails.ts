// Common disposable/temporary email domains for server-side validation
export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "guerrillamail.de", "grr.la", "guerrillamailblock.com", "pokemail.net",
  "sharklasers.com", "spam4.me", "trash-mail.com", "trashmail.com",
  "trashmail.me", "trashmail.net", "yopmail.com", "yopmail.fr", "yopmail.net",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "tempail.com",
  "throwaway.email", "throwaway.com", "dispostable.com", "mailnesia.com",
  "mailcatch.com", "maildrop.cc", "discard.email", "discardmail.com",
  "discardmail.de", "fakeinbox.com", "fakeemail.com", "emailondeck.com",
  "getnada.com", "nada.email", "nada.ltd", "tmpmail.net", "tmpmail.org",
  "mohmal.com", "mohmal.im", "mohmal.in", "burnermail.io", "inboxbear.com",
  "mailsac.com", "10minutemail.com", "10minutemail.net", "10minutemail.org",
  "10minemail.com", "minutemail.com", "tempinbox.com", "tempmailaddress.com",
  "mailtemp.info", "emailfake.com", "emailtemporary.com", "crazymailing.com",
  "harakirimail.com", "jetable.org", "mailexpire.com", "mailforspam.com",
  "mailhazard.com", "mailhz.me", "mailimate.com", "mailnator.com",
  "mailscrap.com", "mailshell.com", "mailsiphon.com", "mailslurp.com",
  "mailzilla.com", "nomail.xl.cx", "objectmail.com", "obobbo.com",
  "onewaymail.com", "proxymail.eu", "rcpt.at", "reallymymail.com",
  "recode.me", "regbypass.com", "safetymail.info", "spamavert.com",
  "spamfree24.org", "spamgourmet.com", "spamhereplease.com", "tempomail.fr",
  "temporaryemail.net", "temporaryforwarding.com", "temporaryinbox.com",
  "thankyou2010.com", "trashemail.de", "trashymail.com", "turual.com",
  "twinmail.de", "wegwerfmail.de", "wegwerfmail.net",
  "tempmailo.com", "emailnax.com", "emltmp.com",
  "mailpoof.com", "tempemails.io", "mailgg.org", "tempr.email", "drdrb.net",
  "maildax.com", "10mail.org", "20mail.it",
  "tempmailer.com", "tempmailer.de", "getairmail.com",
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_EMAIL_DOMAINS.includes(domain);
}
