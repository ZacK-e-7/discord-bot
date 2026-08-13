require('dotenv').config();
const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  AuditLogEvent 
} = require('discord.js');

// ================= EXPRESS WEB SUNUCUSU (7/24 & DOĞRULAMA PORTALI) ================= //
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Render Health Check (Botun 7/24 uyanık kalmasını sağlar)
app.get('/', (req, res) => {
  res.send('🤖 Discord Botu ve Web Portalı 7/24 Aktif!');
});

// Web Doğrulama Portalı Görsel Sayfası
app.get('/verify', (req, res) => {
  const { uid, guild } = req.query;
  if (!uid || !guild) return res.status(400).send('❌ Geçersiz veya eksik doğrulama bağlantısı!');

  res.send(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Valorant Tracker Doğrulama Portalı</title>
      <style>
        body { background-color: #0f1923; color: #ece8e1; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .card { background: #1f2326; padding: 40px; border-radius: 12px; border-top: 5px solid #ff4655; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; max-width: 400px; width: 100%; }
        h2 { color: #ff4655; margin-bottom: 10px; }
        p { font-size: 14px; color: #768079; margin-bottom: 25px; }
        input { width: 100%; padding: 12px; margin-bottom: 15px; border-radius: 6px; border: 1px solid #36393f; background: #0f1923; color: white; box-sizing: border-box; font-size: 16px; text-align: center; }
        button { width: 100%; padding: 14px; background: #ff4655; border: none; color: white; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 16px; transition: 0.2s; }
        button:hover { background: #e03e4d; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>VALORANT DOĞRULAMA</h2>
        <p>Riot Hesabınızı Discord Profilinizle Eşleştirin</p>
        <form action="/verify" method="POST">
          <input type="hidden" name="uid" value="${uid}">
          <input type="hidden" name="guild" value="${guild}">
          <input type="text" name="riotId" placeholder="Nick#Tag (Örn: Zekia#TR1)" required>
          <button type="submit">Hesabı Doğrula ve Rolü Al</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Web Formu Gönderildiğinde Çalışacak İşlem
app.post('/verify', async (req, res) => {
  const { uid, guild, riotId } = req.body;

  if (!riotId || !riotId.includes('#')) {
    return res.send('<h3>❌ Lütfen Riot ID ve Tag bilgini Nick#Tag şeklinde gir!</h3>');
  }

  const [name, tag] = riotId.split('#').map(s => s.trim());

  try {
    const targetGuild = client.guilds.cache.get(guild);
    if (!targetGuild) return res.send('<h3>❌ Sunucu bulunamadı!</h3>');

    const member = await targetGuild.members.fetch(uid).catch(() => null);
    if (!member) return res.send('<h3>❌ Kullanıcı sunucuda bulunamadı!</h3>');

    // Valorant API Sorgusu
    const mmrRes = await fetch(`https://api.henrikdev.xyz/valorant/v1/mmr/eu/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
    const mmrData = await mmrRes.json();

    if (!mmrRes.ok || !mmrData.data || mmrData.status !== 200) {
      return res.send('<h3>❌ Valorant hesabı bulunamadı veya dereceli geçmişi kapalı!</h3>');
    }

    const rawRank = mmrData.data.currenttierpatched || 'Unranked';
    const mainTier = rawRank.split(' ')[0];
    const trRank = rankTranslation[mainTier] || 'Derecesiz';

    // Eski rolleri temizle
    for (const rankName of valorantRanks) {
      const oldRole = targetGuild.roles.cache.find(r => r.name.toLowerCase() === rankName.toLowerCase());
      if (oldRole && member.roles.cache.has(oldRole.id)) {
        await member.roles.remove(oldRole).catch(() => {});
      }
    }

    // Rolü Bul veya Oluştur
    let rankRole = targetGuild.roles.cache.find(r => r.name.toLowerCase() === trRank.toLowerCase());
    if (!rankRole) {
      rankRole = await targetGuild.roles.create({
        name: trRank,
        color: getRankColor(mainTier),
        reason: 'Web Portalı Otomatik Rank Rolü'
      }).catch(() => null);
    }

    if (rankRole) await member.roles.add(rankRole).catch(() => {});

    res.send(`
      <body style="background:#0f1923; color:white; font-family:sans-serif; text-align:center; padding-top:100px;">
        <h1 style="color:#57F287;">🎉 TEBRİKLER!</h1>
        <h2>${name}#${tag} hesabı başarıyla doğrulandı.</h2>
        <p>Discord sunucusundaki <strong>${trRank}</strong> rolünüz hesabınıza tanımlandı. Bu sekmeyi kapatabilirsiniz.</p>
      </body>
    `);
  } catch (err) {
    console.error(err);
    res.send('<h3>❌ Doğrulama sırasında bir hata oluştu.</h3>');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Web Portalı ${PORT} portunda başarıyla başlatıldı!`);
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

const linkWarnings = new Map();
const valorantRanks = ['Demir', 'Bronz', 'Gümüş', 'Altın', 'Platin', 'Elmas', 'Yücelik', 'Ölümsüz', 'Radyant', 'Derecesiz'];
const rankTranslation = {
  'Iron': 'Demir', 'Bronze': 'Bronz', 'Silver': 'Gümüş', 'Gold': 'Altın',
  'Platinum': 'Platin', 'Diamond': 'Elmas', 'Ascendant': 'Yücelik',
  'Immortal': 'Ölümsüz', 'Radiant': 'Radyant', 'Unranked': 'Derecesiz'
};

function getRankColor(tier) {
  const colors = {
    'Iron': '#5A5A5A', 'Bronze': '#8C5A3C', 'Silver': '#A9A9A9', 'Gold': '#E5B80B',
    'Platinum': '#008080', 'Diamond': '#8A2BE2', 'Ascendant': '#00FF7F',
    'Immortal': '#DC143C', 'Radiant': '#FFF8DC'
  };
  return colors[tier] || '#99AAB5';
}

const kufurler = ['amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarak', 'yarrak', 'orospu', 'kahpe', 'puşt', 'pust', 'ipne', 'ibne', 'göt', 'got', 'daşşak'];

function getLogChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => c.name.includes('log') || c.name.includes('mod-log'));
}

function getWelcomeChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => 
    c.name.includes('hoşgeldin') || c.name.includes('hosgeldin') || c.name.includes('hoşgeldiniz') || 
    c.name.includes('hosgeldiniz') || c.name.includes('welcome') || c.name.includes('giriş-çıkış')
  );
}

function isAuthorized(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => 
    ['yönetici', 'yonetici', 'moderatör', 'moderator', 'mod'].some(keyword => role.name.toLowerCase().includes(keyword))
  );
}

client.once('ready', () => {
  console.log(`🤖 Bot aktif! ${client.user.tag} olarak giriş yapıldı.`);
  client.user.setActivity('!yardım | Web Portal & Güvenlik', { type: 3 });
});

// ================= BAN & TIMEOUT LOGLARI ================= //

client.on('guildBanAdd', async (ban) => {
  const logChannel = getLogChannel(ban.guild);
  if (!logChannel) return;
  let executor = 'Bilinmiyor / Otomatik Sistem';
  let reason = 'Sebep Belirtilmedi';
  try {
    const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
    const banLog = fetchedLogs.entries.first();
    if (banLog && banLog.target.id === ban.user.id) {
      if (banLog.executor) executor = `${banLog.executor} (${banLog.executor.tag})`;
      if (banLog.reason) reason = banLog.reason;
    }
  } catch (err) {}

  const embed = new EmbedBuilder()
    .setColor('#992D22')
    .setTitle('🔨 Kullanıcı Yasaklandı (Ban)')
    .addFields(
      { name: 'Yasaklanan', value: `${ban.user} (${ban.user.tag})`, inline: true },
      { name: 'Yetkili', value: executor, inline: true },
      { name: 'Sebep', value: reason }
    )
    .setTimestamp();
  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const logChannel = getLogChannel(newMember.guild);
  if (!logChannel) return;

  if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
    const timeoutUntil = newMember.communicationDisabledUntilTimestamp;
    const minutes = Math.ceil((timeoutUntil - Date.now()) / (1000 * 60));
    let executor = 'Bilinmiyor / Otomatik Sistem';
    try {
      const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
      const timeoutLog = fetchedLogs.entries.first();
      if (timeoutLog && timeoutLog.target.id === newMember.id && timeoutLog.executor) {
        executor = `${timeoutLog.executor} (${timeoutLog.executor.tag})`;
      }
    } catch (err) {}

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('⏰ Kullanıcıya Timeout Atıldı')
      .addFields(
        { name: 'Susturulan', value: `${newMember.user}`, inline: true },
        { name: 'Yetkili', value: executor, inline: true },
        { name: 'Süre', value: `~${minutes} dk (<t:${Math.floor(timeoutUntil / 1000)}:R>)` }
      )
      .setTimestamp();
    return logChannel.send({ embeds: [embed] }).catch(() => {});
  }
});

// ================= HOŞ GELDİN & OTOMATİK ROL ================= //

client.on('guildMemberAdd', async (member) => {
  const autoRole = member.guild.roles.cache.find(role => 
    ['kayıtlı üye', 'kayitli uye', 'üye', 'uye'].some(k => role.name.toLowerCase().includes(k))
  );
  if (autoRole) await member.roles.add(autoRole).catch(() => {});

  const welcomeChannel = getWelcomeChannel(member.guild);
  if (welcomeChannel) {
    const welcomeEmbed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`🎉 Sunucumuza Hoş Geldin ${member.user.username}!`)
      .setDescription(`Aramıza katıldığın için mutluyuz ${member}! 👋\n🏰 **${member.guild.name}** sunucusunda seninle birlikte **${member.guild.memberCount}** kişi olduk!`)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();
    welcomeChannel.send({ embeds: [welcomeEmbed] }).catch(() => {});
  }
});

// ================= KORUMA & KOMUTLAR ================= //

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const content = message.content.toLowerCase();
  const userKey = `${message.guild.id}-${message.author.id}`;

  // Küfür Engeli
  if (!isAuthorized(message.member)) {
    if (kufurler.some(k => content.includes(k))) {
      await message.delete().catch(() => {});
      const msg = await message.channel.send(`⚠️ ${message.author}, bu sunucuda **küfürlü konuşmak yasaktır!**`);
      setTimeout(() => msg.delete().catch(() => {}), 4000);
      return;
    }
  }

  // Link Engeli
  const linkRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|(discord\.(gg|io|me|li)\/[^\s]+)/i;
  if (!isAuthorized(message.member) && linkRegex.test(message.content)) {
    await message.delete().catch(() => {});
    let warnings = (linkWarnings.get(userKey) || 0) + 1;
    linkWarnings.set(userKey, warnings);

    if (warnings === 1) {
      const msg = await message.channel.send(`⚠️ ${message.author}, **link paylaşmak yasaktır!** (Uyarı: 1/5)`);
      setTimeout(() => msg.delete().catch(() => {}), 5000);
    } else if (warnings === 2) {
      await message.member.timeout(5 * 60 * 1000).catch(() => {});
      message.channel.send(`⚠️ ${message.author}, link paylaşımından **5 dk timeout** aldı! (Uyarı: 2/5)`);
    } else if (warnings === 3) {
      await message.member.timeout(24 * 60 * 60 * 1000).catch(() => {});
      message.channel.send(`⚠️ ${message.author}, link paylaşımından **1 gün timeout** aldı! (Uyarı: 3/5)`);
    } else if (warnings === 4) {
      await message.member.timeout(7 * 24 * 60 * 60 * 1000).catch(() => {});
      message.channel.send(`🚨 ${message.author}, link paylaşımından **1 hafta timeout** aldı! (Uyarı: 4/5)`);
    } else if (warnings >= 5) {
      await message.member.ban({ reason: '5 kez link paylaşımı' }).catch(() => {});
      message.channel.send(`🔨 ${message.author.tag}, 5 kez link paylaştığı için **banlandı!**`);
      linkWarnings.delete(userKey);
    }
    return;
  }

  // WEB DOĞRULAMA LİNKİ KOMUTU (!v-rank / !tracker / !doğrula)
  if (content === '!v-rank' || content === '!tracker' || content === '!doğrula') {
    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    const verifyUrl = `${serverUrl}/verify?uid=${message.author.id}&guild=${message.guild.id}`;

    const verifyEmbed = new EmbedBuilder()
      .setColor('#FF4655')
      .setTitle('🌐 Valorant Web Doğrulama Portalı')
      .setDescription(
        `Riot hesabınızı doğrulamak ve otomatik rank rolünüzü almak için aşağıdaki özel bağlantıya tıklayın:\n\n` +
        `🔗 **[Valorant Hesabını Doğrulamak İçin Tıkla](${verifyUrl})**`
      )
      .setFooter({ text: 'Giriş yaptıktan sonra rank rolünüz otomatik tanımlanır.' })
      .setTimestamp();

    return message.reply({ embeds: [verifyEmbed] });
  }

  // Kurallar Komutu
  if (content === '!kurallar') {
    await message.delete().catch(() => {});
    const kurallarEmbed = new EmbedBuilder()
      .setColor('#FFB000')
      .setTitle('KURALLAR')
      .setDescription(
        '👑 • **Kanalları amacı dışında kullanmak yasaktır!**\n\n' +
        '👑 • **Küfür, argo, hakaret yasaktır!**\n\n' +
        '👑 • **Özelden reklam, DM\'den reklam yasaktır!**\n\n' +
        '👑 • **Spam, Flood Yasaktır!**\n\n' +
        '👑 • **Din, dil, ırk ve cinsiyetçilik ayrımı yasaktır.**\n\n' +
        '👑 • **Siyaset yapmak yasaktır.**'
      );
    return message.channel.send({ embeds: [kurallarEmbed] });
  }

  // SA-AS
  if (['sa', 's.a', 'selam'].includes(content)) {
    return message.reply(`Aleykümselam ${message.author}! Hoş geldin 👋`);
  }

  // Sil Komutu
  if (content.startsWith('!sil')) {
    if (!isAuthorized(message.member)) return message.reply('❌ Yetkin yok.');
    const miktar = parseInt(message.content.split(' ')[1]);
    if (isNaN(miktar) || miktar < 1 || miktar > 100) return message.reply('⚠️ 1-100 arası sayı girin.');
    await message.channel.bulkDelete(miktar, true);
    const msg = await message.channel.send(`🧹 **${miktar}** mesaj silindi!`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  }
});

client.login(process.env.DISCORD_TOKEN);