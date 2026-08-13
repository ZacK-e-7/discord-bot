require('dotenv').config();
const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  AuditLogEvent 
} = require('discord.js');

// ================= EXPRESS WEB SUNUCUSU (7/24 KEEPALIVE) ================= //
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Discord Botu 7/24 Aktif ve Çalışıyor!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web sunucusu ${PORT} portunda başarıyla başlatıldı.`);
});

// ================= DISCORD BOTU İŞLEMLERİ ================= //

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
});

// Link Uyarılarını Hafızada Tutacak Sistem
const linkWarnings = new Map();

// Yasaklı Küfür Listesi
const kufurler = [
  'amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarak', 'yarrak', 
  'orospu', 'kahpe', 'puşt', 'pust', 'ipne', 'ibne', 'göt', 'got', 'daşşak'
];

// Mod Log kanalını bulan fonksiyon
function getLogChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('mod-log'));
}

// Hoş Geldin kanalını bulan fonksiyon
function getWelcomeChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => 
    c.name.includes('hoşgeldin') || 
    c.name.includes('hosgeldin') || 
    c.name.includes('hoşgeldiniz') || 
    c.name.includes('hosgeldiniz') || 
    c.name.includes('welcome') || 
    c.name.includes('giriş-çıkış')
  );
}

// Yetkili / Moderatör Kontrolü
function isAuthorized(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => 
    ['yönetici', 'yonetici', 'moderatör', 'moderator', 'mod'].some(keyword => 
      role.name.toLowerCase().includes(keyword)
    )
  );
}

client.once('ready', () => {
  console.log(`🤖 Bot aktif! ${client.user.tag} olarak giriş yapıldı.`);
  client.user.setActivity('!yardım | Koruma & Sistem', { type: 3 });
});

// ================= BAN LOG SİSTEMİ ================= //

client.on('guildBanAdd', async (ban) => {
  const logChannel = getLogChannel(ban.guild);
  if (!logChannel) return;

  let executor = 'Bilinmiyor / Otomatik Sistem';
  let reason = 'Sebep Belirtilmedi';

  try {
    const fetchedLogs = await ban.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.MemberBanAdd,
    });
    const banLog = fetchedLogs.entries.first();

    if (banLog && banLog.target.id === ban.user.id) {
      if (banLog.executor) executor = `${banLog.executor} (${banLog.executor.tag})`;
      if (banLog.reason) reason = banLog.reason;
    }
  } catch (err) {
    console.error('Ban Audit Log çekilemedi:', err);
  }

  const embed = new EmbedBuilder()
    .setColor('#992D22')
    .setTitle('🔨 Kullanıcı Yasaklandı (Ban)')
    .addFields(
      { name: 'Yasaklanan Kullanıcı', value: `${ban.user} (${ban.user.tag})`, inline: true },
      { name: 'Yasaklayan Yetkili / Sistem', value: executor, inline: true },
      { name: 'Yasaklanma Sebebi', value: reason }
    )
    .setFooter({ text: `Kullanıcı ID: ${ban.user.id}` })
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

// ================= TIMEOUT LOG SİSTEMİ ================= //

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const logChannel = getLogChannel(newMember.guild);
  if (!logChannel) return;

  if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
    const timeoutUntil = newMember.communicationDisabledUntilTimestamp;
    const durationMs = timeoutUntil - Date.now();
    const minutes = Math.ceil(durationMs / (1000 * 60));

    let executor = 'Bilinmiyor / Otomatik Sistem';
    try {
      const fetchedLogs = await newMember.guild.fetchAuditLogs({
        limit: 1,
        type: AuditLogEvent.MemberUpdate,
      });
      const timeoutLog = fetchedLogs.entries.first();
      if (timeoutLog && timeoutLog.target.id === newMember.id && timeoutLog.executor) {
        executor = `${timeoutLog.executor} (${timeoutLog.executor.tag})`;
      }
    } catch (err) {
      console.error('Audit Log çekilemedi:', err);
    }

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('⏰ Kullanıcıya Timeout Atıldı')
      .addFields(
        { name: 'Susturulan Kullanıcı', value: `${newMember.user} (${newMember.user.tag})`, inline: true },
        { name: 'Susturan Yetkili / Sistem', value: executor, inline: true },
        { name: 'Süre / Bitiş', value: `Yaklaşık **${minutes} dakika** (<t:${Math.floor(timeoutUntil / 1000)}:R>)` }
      )
      .setFooter({ text: `Kullanıcı ID: ${newMember.id}` })
      .setTimestamp();

    return logChannel.send({ embeds: [embed] }).catch(() => {});
  }

  if (oldMember.isCommunicationDisabled() && !newMember.isCommunicationDisabled()) {
    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🔊 Timeout Kaldırıldı')
      .setDescription(`${newMember.user} (${newMember.user.tag}) üzerindeki timeout süresi doldu veya kaldırıldı.`)
      .setTimestamp();

    return logChannel.send({ embeds: [embed] }).catch(() => {});
  }
});

// ================= HOŞ GELDİN & OTOMATİK ROL SİSTEMİ ================= //

client.on('guildMemberAdd', async (member) => {
  // 1. OTOMATİK ROL VERME
  const autoRole = member.guild.roles.cache.find(role => 
    role.name.toLowerCase().includes('kayıtlı üye') ||
    role.name.toLowerCase().includes('kayitli uye') ||
    role.name.toLowerCase().includes('üye') ||
    role.name.toLowerCase().includes('uye')
  );

  if (autoRole) {
    await member.roles.add(autoRole).catch(() => {});
  }

  // 2. HOŞ GELDİN MESAJI
  const welcomeChannel = getWelcomeChannel(member.guild);
  if (welcomeChannel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`🎉 Sunucumuza Hoş Geldin ${member.user.username}!`)
      .setDescription(`Aramıza katıldığın için çok mutluyuz ${member}! 👋\n\n🏰 **${member.guild.name}** sunucusunda seninle birlikte **${member.guild.memberCount}** üye olduk!${autoRole ? `\n\n✅ **${autoRole.name}** rolün otomatik tanımlandı.` : ''}`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields({
        name: '🛡️ Hesap Oluşturulma Tarihi',
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true
      })
      .setFooter({ text: 'Keyifli vakit geçirmeni dileriz!' })
      .setTimestamp();

    welcomeChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
  }

  // 3. MOD LOG KAYDI
  const logChannel = getLogChannel(member.guild);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📥 Sunucuya Biri Katıldı')
      .setDescription(`${member.user} (${member.user.tag}) katıldı.${autoRole ? `\n🏷️ **Otomatik Rol:** ${autoRole.name}` : ''}\n**Hesap Yaşı:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
      .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }
});

client.on('guildMemberRemove', (member) => {
  const welcomeChannel = getWelcomeChannel(member.guild);
  if (welcomeChannel) {
    const leaveEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle(`📤 Görüşmek Üzere ${member.user.username}...`)
      .setDescription(`${member.user.tag} aramızdan ayrıldı. Kalan üye sayısı: **${member.guild.memberCount}**`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .setTimestamp();

    welcomeChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
  }

  const logChannel = getLogChannel(member.guild);
  if (logChannel) {
    const logEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('📤 Sunucudan Biri Ayrıldı')
      .setDescription(`${member.user} (${member.user.tag}) ayrıldı.`)
      .setTimestamp();

    logChannel.send({ embeds: [logEmbed] }).catch(() => {});
  }
});

// ================= OTOMATİK KORUMA & KOMUTLAR ================= //

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  const userKey = `${message.guild.id}-${message.author.id}`;

  // 1. KÜFÜR ENGELİ (Yetkililer muaf)
  if (!isAuthorized(message.member)) {
    const kufurVar = kufurler.some(kufur => {
      const regex = new RegExp(`\\b${kufur}\\b`, 'i');
      return regex.test(content) || content.includes(kufur);
    });

    if (kufurVar) {
      await message.delete().catch(() => {});
      const uyarimsg = await message.channel.send(`⚠️ ${message.author}, bu sunucuda **küfürlü konuşmak yasaktır!**`);
      setTimeout(() => uyarimsg.delete().catch(() => {}), 4000);
      return;
    }
  }

  // 2. KADEMELİ LİNK ENGELİ (Yetkililer muaf)
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)/i;
  if (!isAuthorized(message.member) && linkRegex.test(message.content)) {
    await message.delete().catch(() => {});

    let warnings = (linkWarnings.get(userKey) || 0) + 1;
    linkWarnings.set(userKey, warnings);

    if (warnings === 1) {
      const msg = await message.channel.send(`⚠️ ${message.author}, **bu sunucuda link paylaşmak yasaktır!** (Uyarı: 1/5)`);
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    } 
    else if (warnings === 2) {
      await message.member.timeout(5 * 60 * 1000, 'Link paylaşımı (2. Uyarı)').catch(() => {});
      const msg = await message.channel.send(`⚠️ ${message.author}, defalarca link paylaştığın için **5 dakika timeout** atıldı! (Uyarı: 2/5)`);
      setTimeout(() => msg.delete().catch(() => {}), 6000);
    } 
    else if (warnings === 3) {
      await message.member.timeout(24 * 60 * 60 * 1000, 'Link paylaşımı (3. Uyarı)').catch(() => {});
      const msg = await message.channel.send(`⚠️ ${message.author}, link paylaşmaya devam ettiğin için **1 gün timeout** atıldı! (Uyarı: 3/5)`);
      setTimeout(() => msg.delete().catch(() => {}), 6000);
    } 
    else if (warnings === 4) {
      await message.member.timeout(7 * 24 * 60 * 60 * 1000, 'Link paylaşımı (4. Uyarı)').catch(() => {});
      const msg = await message.channel.send(`🚨 ${message.author}, link paylaşımına devam ettiğin için **1 hafta timeout** atıldı! Son uyarın! (Uyarı: 4/5)`);
      setTimeout(() => msg.delete().catch(() => {}), 6000);
    } 
    else if (warnings >= 5) {
      await message.member.ban({ reason: '5 kez link paylaşımı yapıldığı için otomatik banlandı.' }).catch(() => {});
      message.channel.send(`🔨 ${message.author.tag}, 5 kez üst üste link paylaştığı için **sunucudan banlandı!**`);
      linkWarnings.delete(userKey);
    }
    return;
  }

  // ================= KOMUTLAR ================= //

  // Otomatik SA-AS
  if (['sa', 's.a', 'selam', 'selamun aleykum', 'selamün aleyküm'].includes(content)) {
    return message.reply(`Aleykümselam ${message.author}! Hoş geldin 👋`);
  }

  // 📜 ŞIK KURALLAR KOMUTU
  if (content === '!kurallar') {
    await message.delete().catch(() => {});

    const kurallarEmbed = new EmbedBuilder()
      .setColor('#FFB000')
      .setAuthor({ 
        name: message.guild.name, 
        iconURL: message.guild.iconURL({ dynamic: true }) 
      })
      .setTitle('KURALLAR')
      .setThumbnail(message.guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
      .setDescription(
        '👑 • **Kanalları amacı dışında kullanmak yasaktır!**\n\n' +
        '👑 • **Küfür, argo, hakaret yasaktır!**\n\n' +
        '👑 • **Özelden reklam, DM\'den reklam yasaktır!**\n\n' +
        '👑 • **Spam, Flood Yasaktır!**\n\n' +
        '👑 • **Chatte tartışma çıkartıp genel huzuru bozmak yasaktır.**\n\n' +
        '👑 • **Din, dil, ırk ve cinsiyetçilik ayrımı yasaktır.**\n\n' +
        '👑 • **Cinsel ve şiddet içerikli paylaşımlar yasaktır.**\n\n' +
        '👑 • **Herhangi bir oyunun hesap satışı, takası yasaktır.**\n\n' +
        '👑 • **Sunucu üyelerinden para, oyun parası, hesap vb. şeyler istemek yasaktır.**\n\n' +
        '👑 • **Ses kanallarını trollemek yasaktır.**\n\n' +
        '👑 • **İnsanların kişisel bilgilerini ve özel hayatıyla ilgili bilgileri paylaşmak yasaktır.**\n\n' +
        '👑 • **Sunucumuzda "Hesap Boost" işlemleri yasaktır.**\n\n' +
        '👑 • **Sunucumuzda yetkili gibi davranmak yasaktır.**\n\n' +
        '👑 • **Sunucumuzda siyaset yapmak yasaktır.**\n\n' +
        '👑 • **Kullanıcı adlarınız moderatörlerin sizi etiketleyebileceği şekilde sade olmalıdır.** *(Farklı karakter kullanımı yasaktır.)*'
      )
      .setFooter({ text: `${message.guild.name} • Sunucu Kuralları` })
      .setTimestamp();

    return message.channel.send({ embeds: [kurallarEmbed] });
  }

  // Yardım Menüsü
  if (content === '!yardım') {
    const yardımEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🤖 Bot Komut & Karşılama Listesi')
      .setDescription('Botumuz **Hoş Geldin** (`📙・hoşgeldiniz`) ve **Mod Log** (`#log`) sistemlerini otomatik destekler.')
      .addFields(
        { name: '📜 Kurallar', value: '`!kurallar` - Sunucu kurallarını şık bir kart şeklinde kanala yazdırır.' },
        { name: '🏷️ Otomatik Rol', value: 'Sunucuya katılan yeni üyelere otomatik **Kayıtlı Üye** rolü tanımlanır.' },
        { name: '👋 Karşılama Sistemi', value: '`📙・hoşgeldiniz` kanalı açarsanız katılan/ayrılan üyeler özel görsel kartlarla karşılanır!' },
        { name: '🛡️ Otomatik Güvenlik', value: '• **Küfür Engeli:** Otomatik silinir.\n• **Link Engeli:** Uyarı -> 5dk Timeout -> 1 Gün -> 1 Hafta -> Ban.' },
        { name: '🎮 Eğlence', value: '`!zar`, `!yazıtura`, `!tkm [taş/kağıt/makas]`, `!karar [a] [b]`' },
        { name: '📊 Bilgi', value: '`!ping`, `!avatar [@kullanıcı]`, `!sunucu`' },
        { name: '🛠️ Moderasyon', value: '`!sil [1-100]`, `!at [@kullanıcı]`' }
      )
      .setTimestamp();

    return message.reply({ embeds: [yardımEmbed] });
  }

  // Ping
  if (content === '!ping') {
    return message.reply(`🏓 Pong! Bot Gecikmesi: **${client.ws.ping}ms**`);
  }

  // Zar
  if (content === '!zar') {
    const zar = Math.floor(Math.random() * 6) + 1;
    return message.reply(`🎲 Zarı attın ve **${zar}** geldi!`);
  }

  // Yazı Tura
  if (content === '!yazıtura') {
    const sonuc = Math.random() < 0.5 ? 'Yazı 🪙' : 'Tura 🪙';
    return message.reply(`Para havaya atıldı... Sonuç: **${sonuc}**`);
  }

  // Taş Kağıt Makas
  if (content.startsWith('!tkm')) {
    const secenekler = ['taş', 'kağıt', 'makas'];
    const oyuncuSecimi = content.split(' ')[1];

    if (!oyuncuSecimi || !secenekler.includes(oyuncuSecimi)) {
      return message.reply('⚠️ Kullanım: `!tkm taş`, `!tkm kağıt` veya `!tkm makas`');
    }

    const botSecimi = secenekler[Math.floor(Math.random() * secenekler.length)];

    if (oyuncuSecimi === botSecimi) return message.reply(`🤝 Berabere! İkiniz de **${botSecimi}** seçtiniz.`);

    const kazandi = 
      (oyuncuSecimi === 'taş' && botSecimi === 'makas') ||
      (oyuncuSecimi === 'kağıt' && botSecimi === 'taş') ||
      (oyuncuSecimi === 'makas' && botSecimi === 'kağıt');

    return message.reply(kazandi 
      ? `🎉 Kazandın! Sen: **${oyuncuSecimi}** | Bot: **${botSecimi}**` 
      : `❌ Kaybettin! Sen: **${oyuncuSecimi}** | Bot: **${botSecimi}**`);
  }

  // Karar
  if (content.startsWith('!karar')) {
    const args = message.content.split(' ').slice(1);
    if (args.length < 2) return message.reply('⚠️ En az 2 seçenek yazmalısın! Örn: `!karar pizza hamburger`');
    const secilen = args[Math.floor(Math.random() * args.length)];
    return message.reply(`🤔 Bence seçimin: **${secilen}** olmalı!`);
  }

  // Sunucu Bilgi
  if (content === '!sunucu') {
    const sunucuEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🏰 ${message.guild.name} Sunucu Bilgileri`)
      .setThumbnail(message.guild.iconURL({ dynamic: true }))
      .addFields(
        { name: '👥 Üye Sayısı', value: `${message.guild.memberCount}`, inline: true },
        { name: '🆔 Sunucu ID', value: `${message.guild.id}`, inline: true }
      );
    return message.reply({ embeds: [sunucuEmbed] });
  }

  // Avatar
  if (content.startsWith('!avatar')) {
    const user = message.mentions.users.first() || message.author;
    return message.reply(`🖼️ **${user.username}** avatarı:\n${user.displayAvatarURL({ size: 1024, dynamic: true })}`);
  }

  // ================= MODERASYON KOMUTLARI ================= //

  // Mesaj Silme
  if (content.startsWith('!sil')) {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }
    const miktar = parseInt(message.content.split(' ')[1]);
    if (isNaN(miktar) || miktar < 1 || miktar > 100) {
      return message.reply('⚠️ 1 ile 100 arasında bir sayı girin. Örn: `!sil 10`');
    }
    await message.channel.bulkDelete(miktar, true);
    const msg = await message.channel.send(`🧹 **${miktar}** mesaj silindi!`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  }

  // Kullanıcı Atma
  if (content.startsWith('!at')) {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Atılacak kullanıcıyı etiketlemelisin!');
    if (!member.kickable) return message.reply('❌ Bu kullanıcıyı atacak yetkim yok.');

    await member.kick();
    return message.reply(`Modern **${member.user.tag}** sunucudan atıldı.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
