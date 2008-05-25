pref('observeclipboard.default', true);

// 0 = current tab, 1 = new tab, 2 = new window, -1 = disabled
pref("observeclipboard.type",          1);
pref("observeclipboard.type.ui",       1);
// 0 = load only the first item, 1 = new tab, 2 = new window, -1 = disabled
pref("observeclipboard.multiple.type", 1);

pref("observeclipboard.schemer",                     "http https ftp news nntp telnet irc mms ed2k about file urn");
pref("observeclipboard.schemer.default",             "http https ftp news nntp telnet irc mms ed2k about file urn");
pref("observeclipboard.schemer.fixup.table",         "www=>http:\/\/www ftp.=>ftp:\/\/ftp. irc.=>irc:irc. h??p=>http h???s=>https ttp=>http tp=>http p=>http ttps=>https tps=>https ps=>https");
pref("observeclipboard.schemer.fixup.table.default", "www=>http:\/\/www ftp.=>ftp:\/\/ftp. irc.=>irc:irc. h??p=>http h???s=>https ttp=>http tp=>http p=>http ttps=>https tps=>https ps=>https");
pref("observeclipboard.schemer.fixup.default", "http");
pref("observeclipboard.multibyte.enabled", true);

pref("observeclipboard.loadInBackground", false);
pref("observeclipboard.loadInBackgroundWindow", true);

pref("observeclipboard.interval", 500);

pref("observeclipboard.loadOnNewTab",   false);
