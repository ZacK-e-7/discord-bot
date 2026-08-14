require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { 
  Client, 
  GatewayIntentBits, 
  Partials,
  EmbedBuilder, 
  PermissionFlagsBits, 
  AuditLogEvent,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

// ================= ÇÖKME ÖNLEYİCİ (CRASH SHIELD) ================= //
process.on('unhandledRejection', (reason, promise) => {
  console.error('Yakalanmayan Reddetme (Unhandled Rejection):', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error('Yakalanmayan İstisna (Uncaught Exception):', err);
});

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
    GatewayIntentBits.GuildExpressions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.User]
});

// Link Uyarıları Hafızası
const linkWarnings = new Map();
let lastValoNewsUrl = '';

// ================= VALORANT AJANLARI LİSTESİ ================= //
const valorantAgents = [
  { name: 'Jett', role: 'Düellocu 🗡️', color: '#87CEEB', desc: 'Çevik, rüzgar gibi hızlı ve agresif oyun tarzı için 1 numara!' },
  { name: 'Reyna', role: 'Düellocu 🗡️', color: '#8A2BE2', desc: 'Birebir çatışmalarda rakipleri eritmek ve maçı taşımak için mükemmel.' },
  { name: 'Raze', role: 'Düellocu 🗡️', color: '#FF4500', desc: 'Patlayıcı çantalar ve roketatarla alan kontrolünü ele geçir!' },
  { name: 'Phoenix', role: 'Düellocu 🗡️', color: '#FF6347', desc: 'Flaşlarınla kör et, ateş duvarınla canını doldurup saldır!' },
  { name: 'Yoru', role: 'Düellocu 🗡️', color: '#1E90FF', desc: 'Boyutlar arası geçiş yap, rakipleri sahte seslerle şaşırt!' },
  { name: 'Neon', role: 'Düellocu 🗡️', color: '#00FFFF', desc: 'Yüksek elektrik hızı ve kayma mekaniğiyle düşmanları gafil avla!' },
  { name: 'Iso', role: 'Düellocu 🗡️', color: '#9370DB', desc: 'Kalkanını aç ve rakiplerini 1v1 arenasına çekerek infaz et!' },
  { name: 'Sova', role: 'Öncü 🏹', color: '#4682B4', desc: 'Görüş ve şok oklarıyla haritanın her köşesinden bilgi topla.' },
  { name: 'Breach', role: 'Öncü 💥', color: '#CD853F', desc: 'Duvarların arkasından sarsıntı ve flaş yağdırarak alanı temizle!' },
  { name: 'Skye', role: 'Öncü 🦅', color: '#2E8B57', desc: 'Kuşlarınla düşmanları kör et ve kurtlarınla rakipleri avla.' },
  { name: 'KAY/O', role: 'Öncü 🤖', color: '#708090', desc: 'Bıçağınla düşman yeteneklerini tamamen kilitle ve sustur!' },
  { name: 'Fade', role: 'Öncü 👁️', color: '#2F4F4F', desc: 'Gölgelerle düşmanların peşine düş ve kulaklarını sağır et!' },
  { name: 'Gekko', role: 'Öncü 🦎', color: '#7FFF00', desc: 'Kankalarınla spike kur, kör et ve yeteneklerini yerden geri topla!' },
  { name: 'Omen', role: 'Kontrol Uzmanı ☁️', color: '#483D8B', desc: 'Karanlık dumanlar at ve haritanın kör noktalarına ışınlan.' },
  { name: 'Brimstone', role: 'Kontrol Uzmanı ☄️', color: '#D2691E', desc: 'Gökyüzünden dumanlar indir ve ultinle alanı yakıp kül et!' },
  { name: 'Viper', role: 'Kontrol Uzmanı 🐍', color: '#006400', desc: 'Zehirli gaz bulutu ve perde ile siteleri tek başına tut!' },
  { name: 'Astra', role: 'Kontrol Uzmanı 🌌', color: '#4B0082', desc: 'Kozmik formda yıldızlar yerleştirip haritayı uzaktan yönet.' },
  { name: 'Harbor', role: 'Kontrol Uzmanı 🌊', color: '#008080', desc: 'Su kalkanları ve dev dalgalarla takımına güvenli geçiş sağla.' },
  { name: 'Clove', role: 'Kontrol Uzmanı 🦋', color: '#DA70D6', desc: 'Öldükten sonra bile duman atabilen cesur ve korkusuz kelebek!' },
  { name: 'Killjoy', role: 'Gözcü 🤖', color: '#FFD700', desc: 'Taretlerin ve alarm botlarınla bombalama alanını kaleye dönüştür!' },
  { name: 'Cypher', role: 'Gözcü 🕵️', color: '#A9A9A9', desc: 'Gizli kameralar ve tuzak telleriyle rakipten hiçbir şey kaçmaz.' },
  { name: 'Sage', role: 'Gözcü 🧊', color: '#00FA9A', desc: 'Buz duvarıyla yolu kapat, takım arkadaşlarını iyileştir ve dirilt!' },
  { name: 'Chamber', role: 'Gözcü 🎩', color: '#DAA520', desc: 'Ağır tabancan ve özel sniper tüfeğinle klas vuruşlar yap.' },
  { name: 'Deadlock', role: 'Gözcü 🕸️', color: '#B0C4DE', desc: 'Ses sensörleri ve nanotel bariyerleriyle düşman koşularını durdur!' },
  { name: 'Vyse', role: 'Gözcü 🌹', color: '#800020', desc: 'Sıvı metal gülleri ve duvar tuzaklarıyla rakipleri silahsız bırak!' }
];

// ================= KALICI VE SONSUZ SEVİYE SİSTEMİ ================= //
const DATA_FILE = path.join(__dirname, 'levels.json');

function loadLevels() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      return new Map(Object.entries(parsed));
    }
  } catch (err) {
    console.error('Kayıtlı seviye verileri okunurken hata oluştu:', err);
  }
  return new Map();
}

function saveLevels() {
  try {
    const obj = Object.fromEntries(userLevelMap);
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (err) {
    console.error('Seviye verileri kaydedilirken hata oluştu:', err);
  }
}

const userLevelMap = loadLevels();

function getNeededXP(level) {
  return Math.floor(30 * Math.pow(level, 2) + 20 * level);
}

function createProgressBar(currentXP, neededXP) {
  const percentage = Math.min(1, Math.max(0, currentXP / neededXP));
  const totalBars = 10;
  const filledBars = Math.round(percentage * totalBars);
  const emptyBars = totalBars - filledBars;
  const bar = '🟩'.repeat(filledBars) + '⬛'.repeat(emptyBars);
  return `${bar} (%${Math.floor(percentage * 100)})`;
}

// Yasaklı Küfür Listesi
const kufurler = [
  'amk', 'aq', 'amq', 'oç', 'oc', 'piç', 'pic', 'sik', 'yarak', 'yarrak', 
  'orospu', 'kahpe', 'puşt', 'pust', 'ipne', 'ibne', 'göt', 'got', 'daşşak'
];

function getLogChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => c.name.includes('mod-log') || c.name.includes('modlog') || c.name.includes('log'));
}

function getWelcomeChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => 
    c.name.includes('hoşgeldin') || c.name.includes('hosgeldin') || 
    c.name.includes('hoşgeldiniz') || c.name.includes('hosgeldiniz') || 
    c.name.includes('welcome') || c.name.includes('giriş-çıkış')
  );
}

function getLevelChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => 
    c.name.includes('level-bilgi') || 
    c.name.includes('levelbilgi') || 
    c.name.includes('seviye-bilgi') || 
    c.name.includes('seviyebilgi') || 
    c.name.includes('level-bilgisi')
  );
}

function getValoNewsChannel(guild) {
  if (!guild) return null;
  return guild.channels.cache.find(c => 
    c.name.includes('valorant-haber') || 
    c.name.includes('valohaber') || 
    c.name.includes('valo-haber') || 
    c.name.includes('oyun-haber') || 
    c.name.includes('oyun-haberleri') || 
    c.name.includes('haberler')
  );
}

function isAuthorized(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return member.roles.cache.some(role => 
    ['yönetici', 'yonetici', 'moderatör', 'moderator', 'mod'].some(keyword => 
      role.name.toLowerCase().includes(keyword)
    )
  );
}

// ================= VALORANT HABER ÇEKİCİ ================= //
async function fetchLatestValoNews() {
  try {
    const res = await fetch('https://playvalorant.com/page-data/tr-tr/news/page-data.json');
    if (!res.ok) return null;
    const data = await res.json();
    const articles = data?.result?.data?.allContentstackArticles?.nodes;
    if (articles && articles.length > 0) {
      const latest = articles[0];
      return {
        title: latest.title || 'Yeni Valorant Haberi',
        description: latest.description || 'Detaylar ve yama notları için resmi sayfayı ziyaret edin.',
        url: latest.url?.url ? (latest.url.url.startsWith('http') ? latest.url.url : `https://playvalorant.com/tr-tr${latest.url.url}`) : 'https://playvalorant.com/tr-tr/news/',
        image: latest.banner?.url || null,
        category: latest.category?.[0]?.title || 'GÜNCELLEME & HABER'
      };
    }
  } catch (err) {
    console.error('Valorant haber çekilemedi:', err);
  }
  return null;
}

// ================= BOT DURUMU & OTOMATİK HABERLER ================= //

client.once('ready', async () => {
  console.log(`🤖 Bot aktif! ${client.user.tag} olarak giriş yapıldı.`);
  console.log(`💾 Toplam ${userLevelMap.size} kullanıcının seviye verisi yüklendi.`);

  const initialNews = await fetchLatestValoNews();
  if (initialNews) lastValoNewsUrl = initialNews.url;

  const durumlar = [
    '!yardım',
    'Beni etiketle soru sor!',
    'K7e'
  ];

  let index = 0;
  client.user.setActivity(durumlar[0], { type: 3 });

  setInterval(() => {
    index = (index + 1) % durumlar.length;
    client.user.setActivity(durumlar[index], { type: 3 });
  }, 6000);

  // 15 Dakikada Bir Otomatik Haber Kontrolü
  setInterval(async () => {
    try {
      const latestNews = await fetchLatestValoNews();
      if (latestNews && latestNews.url && latestNews.url !== lastValoNewsUrl) {
        lastValoNewsUrl = latestNews.url;

        client.guilds.cache.forEach(guild => {
          const valoChannel = getValoNewsChannel(guild);
          if (valoChannel) {
            const newsEmbed = new EmbedBuilder()
              .setColor('#FF4655')
              .setTitle(`📢 Yeni Valorant Haberi: ${latestNews.title}`)
              .setURL(latestNews.url)
              .setDescription(`${latestNews.description}\n\n👉 [Haberi Resmi Sitede Oku](${latestNews.url})`)
              .addFields({ name: '🏷️ Kategori', value: latestNews.category, inline: true })
              .setFooter({ text: 'K7e • Otomatik Valorant Haber Sistemi' })
              .setTimestamp();

            if (latestNews.image) newsEmbed.setImage(latestNews.image);

            valoChannel.send({ content: '🔔 **Yeni bir Valorant güncellemesi / haberi paylaşıldı!**', embeds: [newsEmbed] }).catch(() => {});
          }
        });
      }
    } catch (e) {}
  }, 15 * 60 * 1000);
});

// ================= 🔍 HATASIZ GELİŞMİŞ MOD-LOG SİSTEMİ ================= //

// 1. MESAJ SİLİNDİ LOGU
client.on('messageDelete', async (message) => {
  try {
    if (!message.guild || message.author?.bot) return;
    const logChannel = getLogChannel(message.guild);
    if (!logChannel || logChannel.id === message.channel?.id) return;

    const authorText = message.author 
      ? `${message.author} (\`${message.author.tag}\`)` 
      : '*Bilinmeyen Kullanıcı (Eski Mesaj)*';

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Bir Mesaj Silindi')
      .addFields(
        { name: '👤 Yazar', value: authorText, inline: true },
        { name: '📍 Kanal', value: message.channel ? `${message.channel}` : 'Bilinmeyen Kanal', inline: true },
        { name: '📝 Silinen İçerik', value: message.content ? (message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content) : '*İçerik okunamadı veya medya/fotoğraf içeriyordu.*' }
      )
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('messageDelete Log Hatası:', err);
  }
});

// 2. MESAJ DÜZENLENDİ LOGU
client.on('messageUpdate', async (oldMessage, newMessage) => {
  try {
    if (!oldMessage.guild || oldMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    const logChannel = getLogChannel(oldMessage.guild);
    if (!logChannel || logChannel.id === oldMessage.channel?.id) return;

    const authorText = newMessage.author 
      ? `${newMessage.author} (\`${newMessage.author.tag}\`)` 
      : (oldMessage.author ? `${oldMessage.author} (\`${oldMessage.author.tag}\`)` : '*Bilinmeyen Kullanıcı*');

    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setTitle('✏️ Bir Mesaj Düzenlendi')
      .addFields(
        { name: '👤 Yazar', value: authorText, inline: true },
        { name: '📍 Kanal', value: `${oldMessage.channel}`, inline: true },
        { name: '📜 Eski Hali', value: oldMessage.content ? (oldMessage.content.length > 500 ? oldMessage.content.substring(0, 500) + '...' : oldMessage.content) : '*Eski içerik okunamadı.*' },
        { name: '✨ Yeni Hali', value: newMessage.content ? (newMessage.content.length > 500 ? newMessage.content.substring(0, 500) + '...' : newMessage.content) : '*Yeni içerik okunamadı.*' }
      )
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('messageUpdate Log Hatası:', err);
  }
});

// 3. KULLANICI GÜNCELLEMELERİ (Rol, Nickname, Timeout)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const logChannel = getLogChannel(newMember.guild);
    if (!logChannel) return;

    // A. Timeout
    if (!oldMember.isCommunicationDisabled() && newMember.isCommunicationDisabled()) {
      const timeoutUntil = newMember.communicationDisabledUntilTimestamp;
      const minutes = Math.ceil((timeoutUntil - Date.now()) / (1000 * 60));
      let executor = 'Yetkili';
      try {
        const fetchedLogs = await newMember.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberUpdate });
        const timeoutLog = fetchedLogs.entries.first();
        if (timeoutLog && timeoutLog.target.id === newMember.id && timeoutLog.executor) {
          executor = `${timeoutLog.executor.tag}`;
        }
      } catch (err) {}

      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('⏰ Kullanıcıya Timeout Atıldı')
        .addFields(
          { name: 'Susturulan', value: `${newMember.user} (\`${newMember.user.tag}\`)`, inline: true },
          { name: 'İşlemi Yapan', value: executor, inline: true },
          { name: 'Süre', value: `~${minutes} dakika` }
        )
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();

      return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // B. Takma Ad
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏷️ Kullanıcı Takma Adı Değiştirildi')
        .addFields(
          { name: '👤 Kullanıcı', value: `${newMember.user} (\`${newMember.user.tag}\`)`, inline: false },
          { name: 'Eski İsim', value: oldMember.nickname || oldMember.user.username, inline: true },
          { name: 'Yeni İsim', value: newMember.nickname || newMember.user.username, inline: true }
        )
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();

      return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // C. Rol Değişikliği
    if (oldMember.roles.cache.size !== newMember.roles.cache.size) {
      const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
      const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

      if (addedRoles.size > 0) {
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('➕ Kullanıcıya Rol Eklendi')
          .addFields(
            { name: '👤 Kullanıcı', value: `${newMember.user} (\`${newMember.user.tag}\`)`, inline: true },
            { name: 'Verilen Rol(ler)', value: addedRoles.map(r => `${r}`).join(', '), inline: true }
          )
          .setFooter({ text: 'K7e • Mod-Log Sistemi' })
          .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
      }

      if (removedRoles.size > 0) {
        const embed = new EmbedBuilder()
          .setColor('#ED4245')
          .setTitle('➖ Kullanıcıdan Rol Alındı')
          .addFields(
            { name: '👤 Kullanıcı', value: `${newMember.user} (\`${newMember.user.tag}\`)`, inline: true },
            { name: 'Alınan Rol(ler)', value: removedRoles.map(r => `${r.name}`).join(', '), inline: true }
          )
          .setFooter({ text: 'K7e • Mod-Log Sistemi' })
          .setTimestamp();

        logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('guildMemberUpdate Log Hatası:', err);
  }
});

// 4. KANAL OLUŞTURULDU LOGU
client.on('channelCreate', async (channel) => {
  try {
    if (!channel.guild) return;
    const logChannel = getLogChannel(channel.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📁 Yeni Kanal Oluşturuldu')
      .addFields(
        { name: 'Kanal Adı', value: `\`#${channel.name}\``, inline: true },
        { name: 'Kanal Türü', value: channel.type === 2 ? 'Ses Kanalı 🔊' : 'Metin Kanalı 💬', inline: true }
      )
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

// 5. KANAL SİLİNDİ LOGU
client.on('channelDelete', async (channel) => {
  try {
    if (!channel.guild) return;
    const logChannel = getLogChannel(channel.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Bir Kanal Silindi')
      .addFields({ name: 'Silinen Kanal', value: `\`#${channel.name}\``, inline: true })
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

// 6. ROL OLUŞTURULDU / SİLİNDİ LOGU
client.on('roleCreate', async (role) => {
  try {
    const logChannel = getLogChannel(role.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🎭 Yeni Rol Oluşturuldu')
      .addFields({ name: 'Rol Adı', value: `${role} (\`${role.name}\`)`, inline: true })
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

client.on('roleDelete', async (role) => {
  try {
    const logChannel = getLogChannel(role.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Bir Rol Silindi')
      .addFields({ name: 'Silinen Rol', value: `\`${role.name}\``, inline: true })
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

// 7. SUNUCU İSMİ DEĞİŞTİRİLDİ
client.on('guildUpdate', async (oldGuild, newGuild) => {
  try {
    const logChannel = getLogChannel(newGuild);
    if (!logChannel) return;

    if (oldGuild.name !== newGuild.name) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🏰 Sunucu Adı Değiştirildi')
        .addFields(
          { name: 'Eski İsim', value: `\`${oldGuild.name}\``, inline: true },
          { name: 'Yeni İsim', value: `\`${newGuild.name}\``, inline: true }
        )
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();

      logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (e) {}
});

// 8. SES KANALI HAREKETLERİ
client.on('voiceStateUpdate', async (oldState, newState) => {
  try {
    const logChannel = getLogChannel(newState.guild || oldState.guild);
    if (!logChannel) return;

    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    // Giriş
    if (!oldState.channelId && newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle('🔊 Ses Kanalına Katıldı')
        .setDescription(`${member} (\`${member.user.tag}\`) kullanıcısı **${newState.channel?.name}** odasına bağlandı.`)
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();
      return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // Çıkış
    if (oldState.channelId && !newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔇 Ses Kanalından Ayrıldı')
        .setDescription(`${member} (\`${member.user.tag}\`) kullanıcısı **${oldState.channel?.name}** odasından ayrıldı.`)
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();
      return logChannel.send({ embeds: [embed] }).catch(() => {});
    }

    // Değiştirme
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🔀 Ses Kanalı Değiştirdi')
        .setDescription(`${member} kullanıcısı **${oldState.channel?.name}** ➔ **${newState.channel?.name}** odasına geçti.`)
        .setFooter({ text: 'K7e • Mod-Log Sistemi' })
        .setTimestamp();
      return logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (e) {}
});

// 9. BAN VE UNBAN LOGLARI
client.on('guildBanAdd', async (ban) => {
  try {
    const logChannel = getLogChannel(ban.guild);
    if (!logChannel) return;
    let executor = 'Yetkili';
    let reason = 'Sebep Belirtilmedi';

    try {
      const fetchedLogs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd });
      const banLog = fetchedLogs.entries.first();
      if (banLog && banLog.target.id === ban.user.id && banLog.executor) {
        executor = `${banLog.executor.tag}`;
        if (banLog.reason) reason = banLog.reason;
      }
    } catch (err) {}

    const embed = new EmbedBuilder()
      .setColor('#992D22')
      .setTitle('🔨 Kullanıcı Yasaklandı (Ban)')
      .addFields(
        { name: 'Yasaklanan', value: `${ban.user} (\`${ban.user.tag}\`)`, inline: true },
        { name: 'Yetkili', value: executor, inline: true },
        { name: 'Sebep', value: reason }
      )
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

client.on('guildBanRemove', async (ban) => {
  try {
    const logChannel = getLogChannel(ban.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🔓 Yasak Kaldırıldı (Unban)')
      .addFields({ name: 'Kullanıcı', value: `${ban.user} (\`${ban.user.tag}\`)`, inline: true })
      .setFooter({ text: 'K7e • Mod-Log Sistemi' })
      .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (e) {}
});

// ================= HOŞ GELDİN & OTOMATİK ROL ================= //

client.on('guildMemberAdd', async (member) => {
  try {
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
  } catch (e) {}
});

client.on('guildMemberRemove', (member) => {
  try {
    const welcomeChannel = getWelcomeChannel(member.guild);
    if (welcomeChannel) {
      const leaveEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle(`📤 Görüşmek Üzere ${member.user.username}...`)
        .setDescription(`${member.user.tag} aramızdan ayrıldı. Kalan üye sayısı: **${member.guild.memberCount}**`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();
      welcomeChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
    }
  } catch (e) {}
});

// ================= BUTON ETKİLEŞİMİ (VALORANT AJAN SEÇİCİ) ================= //

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'btn_random_agent') {
    const randomAgent = valorantAgents[Math.floor(Math.random() * valorantAgents.length)];

    const agentEmbed = new EmbedBuilder()
      .setColor(randomAgent.color)
      .setTitle(`🎯 Bu Maçtaki Ajanın: **${randomAgent.name}**`)
      .setAuthor({ name: 'VALORANT • Rastgele Ajan Seçici', iconURL: 'https://cdn-icons-png.flaticon.com/512/588/588258.png' })
      .addFields(
        { name: '🎭 Rol', value: `**${randomAgent.role}**`, inline: true },
        { name: '💡 Taktik / Özellik', value: randomAgent.desc, inline: false }
      )
      .setFooter({ text: 'K7e • Bol şans ve iyi vuruşlar!' })
      .setTimestamp();

    await interaction.reply({ embeds: [agentEmbed], ephemeral: true });
  }
});

// ================= MESAJ DİNLEYİCİ (KORUMA, AI, XP VE KOMUTLAR) ================= //

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.toLowerCase();
  const userKey = `${message.guild.id}-${message.author.id}`;

  // 1. KÜFÜR ENGELİ
  if (!isAuthorized(message.member)) {
    if (kufurler.some(k => content.includes(k))) {
      await message.delete().catch(() => {});
      const uyarimsg = await message.channel.send(`⚠️ ${message.author}, bu sunucuda **küfürlü konuşmak yasaktır!**`);
      setTimeout(() => uyarimsg.delete().catch(() => {}), 4000);
      return;
    }
  }

  // 2. LİNK ENGELİ
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

  // 3. 🧠 BOT ETİKETLENDİĞİNDE YAPAY ZEKA SOHBETİ
  if (message.mentions.has(client.user.id) && !message.mentions.everyone) {
    const userPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

    if (!userPrompt) {
      return message.reply('Efendim? 😊 Bana bir soru sormak istersen etiketleyip sorunu yazabilirsin!\n*Örnek:* `@Boom Bot nasılsın?`');
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return message.reply('⚠️ Render panelinde `GEMINI_API_KEY` tanımlı değil.');
    }

    try {
      await message.channel.sendTyping();

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Sen Discord sunucusunda hizmet veren samimi, esprili, zeki ve yardımsever bir asistansın. Adın: Boom Bot. Kullanıcıya Türkçe olarak samimi, doğal ve sohbet ortamına uygun şekilde cevap ver. Aşırı resmi veya aşırı uzun destanlar yazma. Kullanıcının sorusu: "${userPrompt}"`
            }]
          }]
        })
      });

      const data = await response.json();

      if (data.error) {
        return message.reply(`❌ API Hatası: ${data.error.message || 'Bilinmeyen hata'}`);
      }

      const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!replyText) {
        return message.reply('Şu an düşüncelerimi toparlayamadım, lütfen sorunu tekrar sor! 🤔');
      }

      if (replyText.length > 2000) {
        return message.reply(replyText.substring(0, 1990) + '...');
      }

      return message.reply(replyText);
    } catch (err) {
      console.error('AI Hatası:', err);
      return message.reply('❌ Bağlantı hatası oluştu, lütfen biraz sonra tekrar deneyin.');
    }
  }

  // 4. SOHBET XP VE SEVİYE SİSTEMİ
  if (!content.startsWith('!')) {
    let userData = userLevelMap.get(userKey) || { xp: 0, level: 1, lastXpTime: 0 };
    const now = Date.now();

    if (now - userData.lastXpTime >= 5000) {
      const earnedXP = Math.floor(Math.random() * 16) + 25;
      userData.xp += earnedXP;
      userData.lastXpTime = now;

      const neededXP = getNeededXP(userData.level);

      if (userData.xp >= neededXP) {
        userData.level += 1;

        const levelUpEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🎉 SEVİYE ATLADIN!')
          .setDescription(`Tebrikler ${message.author}! Sohbet ettikçe güçleniyorsun! 🚀\n\n⭐ Yeni Seviyen: **${userData.level}**`)
          .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        const levelChannel = getLevelChannel(message.guild) || message.channel;
        levelChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
      }

      userLevelMap.set(userKey, userData);
      saveLevels();
    }
  }

  // ================= KOMUTLAR ================= //

  // 📰 VALORANT HABER KOMUTU (!valohaber)
  if (content === '!valohaber' || content === '!valo-haber') {
    const news = await fetchLatestValoNews();
    if (!news) return message.reply('❌ En son Valorant haberi alınamadı, lütfen daha sonra tekrar deneyin.');

    const newsEmbed = new EmbedBuilder()
      .setColor('#FF4655')
      .setTitle(`📢 ${news.title}`)
      .setURL(news.url)
      .setDescription(`${news.description}\n\n👉 [Haberi Resmi Sitede Oku](${news.url})`)
      .addFields({ name: '🏷️ Kategori', value: news.category, inline: true })
      .setFooter({ text: 'K7e • Valorant Güncel Haber' })
      .setTimestamp();

    if (news.image) newsEmbed.setImage(news.image);

    return message.reply({ embeds: [newsEmbed] });
  }

  // 🎮 VALORANT AJAN PANELİ KOMUTU (!ajanpanel)
  if (content === '!ajanpanel' || content === '!ajan-panel') {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }

    await message.delete().catch(() => {});

    const panelEmbed = new EmbedBuilder()
      .setColor('#FF4655')
      .setTitle('🎯 VALORANT RASTGELE AJAN SEÇİCİ')
      .setDescription(
        'Hangi ajanı oynayacağına karar veremedin mi? 🤔\n\n' +
        'Aşağıdaki butona basarak sistemin senin için tamamen **rastgele bir ajan** seçmesini sağlayabilirsin!\n\n' +
        '🎲 *Seçilen ajan ve rol bilgisi sadece sana özel görünecektir.*'
      )
      .setImage('https://images.contentstack.io/v3/assets/bltb6530b271fddd0b1/blt804071d8be8d5d4d/66184918e953a7a9228d447d/Valorant_2024_EP8-2_Textless_3840x2160.jpg')
      .setFooter({ text: 'K7e • Valorant Ajan Sistemi' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_random_agent')
        .setLabel('🎲 Rastgele Ajan Seç')
        .setStyle(ButtonStyle.Danger)
    );

    return message.channel.send({ embeds: [panelEmbed], components: [row] });
  }

  // 👑 ADMIN KONTROL PANELİ
  if (content === '!admin' || content === '!yönetim' || content === '!yonetim') {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }

    const adminEmbed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🛡️ YÖNETİCİ & MODERATÖR KONTROL PANELİ')
      .setAuthor({ name: `${message.guild.name} Yönetimi`, iconURL: message.guild.iconURL({ dynamic: true }) })
      .setDescription('Sunucumuzda yetkililere özel moderasyon komutları ve aktif güvenlik modülleri aşağıdadır:')
      .addFields(
        {
          name: '🛠️ Moderasyon & Kurulum Komutları',
          value: 
            '• `!ajanpanel` : Valorant butonlu rastgele ajan panelini kurar.\n' +
            '• `!valohaber` : En son Valorant haberini getirir.\n' +
            '• `!xpekle [@üye] [miktar]` : Kullanıcıya XP ekler.\n' +
            '• `!sustur [@üye] [dakika] [sebep]` : Kullanıcıya timeout atar.\n' +
            '• `!sil [1-100]` : Belirtilen sayıda mesajı topluca siler.\n' +
            '• `!at [@üye]` : Etiketlenen kullanıcıyı sunucudan atar (Kick).\n' +
            '• `!kurallar` : Kurallar panosunu kanala gönderir.\n' +
            '• `!admin` : Bu yönetim panelini açar.'
        },
        {
          name: '⚙️ Aktif Denetim & Koruma Modülleri',
          value: 
            '• 🟢 **Mod-Log Sistemi:** Aktif (Mesaj silme/düzenleme, rol, ses, kanal, isim değişimleri).\n' +
            '• 🟢 **Yapay Zeka:** Açık (Botu etiketleyerek soru sorulabilir).\n' +
            '• 🟢 **Valorant Otomatik Haber:** Açık (`#valorant-haberleri` kanalında 15 dk bir kontrol).\n' +
            '• 🟢 **Valorant Ajan Seçici:** Açık (`!ajanpanel`).\n' +
            '• 🟢 **Limitsiz Seviye Sistemi:** Açık (Veriler anında diske kaydedilir).\n' +
            '• 🟢 **Küfür Filtresi:** Açık (Yetkililer hariç mesajları siler).\n' +
            '• 🟢 **Reklam / Link Engeli:** Açık (5 aşamalı ceza sistemi).'
        },
        {
          name: '📊 Sunucu & Bot Bilgisi',
          value: `• **Gecikme (Ping):** ${client.ws.ping}ms\n• **Toplam Üye:** ${message.guild.memberCount}`
        }
      )
      .setFooter({ text: 'K7e • Yönetim Masası' })
      .setTimestamp();

    return message.reply({ embeds: [adminEmbed] });
  }

  // ⭐ YÖNETİCİ XP EKLEME KOMUTU (!xpekle / !xpver)
  if (content.startsWith('!xpekle') || content.startsWith('!xp-ekle') || content.startsWith('!xpver') || content.startsWith('!xp-ver')) {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }

    const args = message.content.split(/\s+/).slice(1);
    const targetMember = message.mentions.members.first();
    if (!targetMember) {
      return message.reply('⚠️ Lütfen XP verilecek kullanıcıyı etiketleyin!\n👉 **Kullanım:** `!xpekle @kullanıcı [miktar]`');
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply('⚠️ Lütfen geçerli pozitif bir XP miktarı girin (Örn: `!xpekle @kullanıcı 100`)!');
    }

    const targetKey = `${message.guild.id}-${targetMember.id}`;
    let userData = userLevelMap.get(targetKey) || { xp: 0, level: 1, lastXpTime: 0 };

    userData.xp += amount;
    const oldLevel = userData.level;

    while (userData.xp >= getNeededXP(userData.level)) {
      userData.level += 1;
    }

    userLevelMap.set(targetKey, userData);
    saveLevels();

    let responseMsg = `⭐ ${targetMember} kullanıcısına başarıyla **+${amount} XP** eklendi! (Toplam XP: **${userData.xp}**)`;

    if (userData.level > oldLevel) {
      responseMsg += `\n🎉 **Tebrikler!** Yeni Seviyesi: **${userData.level}** 🚀`;

      const levelChannel = getLevelChannel(message.guild);
      if (levelChannel) {
        const levelUpEmbed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle('🎉 SEVİYE ATLADIN!')
          .setDescription(`Tebrikler ${targetMember}! Yönetici tarafından verilen XP ile seviye atladın! 🚀\n\n⭐ Yeni Seviyen: **${userData.level}**`)
          .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        levelChannel.send({ embeds: [levelUpEmbed] }).catch(() => {});
      }
    }

    return message.reply(responseMsg);
  }

  // ⏰ SUSTURMA / TIMEOUT KOMUTU
  if (content.startsWith('!sustur') || content.startsWith('!timeout')) {
    if (!isAuthorized(message.member)) return message.reply('❌ Bu komutu kullanmak için yetkiniz yok.');
    
    const args = message.content.split(/\s+/).slice(1);
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply('⚠️ Lütfen susturulacak kullanıcıyı etiketleyin!\n👉 **Kullanım:** `!sustur @kullanıcı [dakika] [sebep]`');
    }

    const dakika = parseInt(args[1]);
    if (isNaN(dakika) || dakika <= 0 || dakika > 40320) {
      return message.reply('⚠️ Lütfen geçerli bir süre belirtin (Dakika cinsinden, örn: 5, 10, 60)!');
    }

    const sebep = args.slice(2).join(' ') || 'Sebep belirtilmedi';

    if (!member.moderatable) {
      return message.reply('❌ Bu kullanıcıyı susturamam (Yetkisi benden veya sizden yüksek olabilir).');
    }

    try {
      await member.timeout(dakika * 60 * 1000, `${message.author.tag} tarafından: ${sebep}`);
      return message.reply(`⏰ **${member.user.tag}** kullanıcısı **${dakika} dakika** susturuldu!\n📝 **Sebep:** ${sebep}`);
    } catch (err) {
      return message.reply('❌ Kullanıcı susturulurken bir hata oluştu.');
    }
  }

  // 📈 SEVİYE / RANK KOMUTLARI
  if (
    content === '!seviye' || content === '!level' || content === '!rank' || content.startsWith('!seviye ') || content.startsWith('!level ') || content.startsWith('!rank ') ||
    content === '!liderlik' || content === '!top'
  ) {
    const channelName = message.channel.name.toLowerCase();
    const isLevelChannel = ['level-bilgi', 'levelbilgi', 'seviye-bilgi', 'seviyebilgi', 'level-bilgisi'].some(k => channelName.includes(k));

    if (!isLevelChannel) {
      const warnMsg = await message.reply('⚠️ Seviye komutlarını sadece **#level-bilgi** kanalında kullanabilirsin!');
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      return;
    }

    if (content === '!seviye' || content === '!level' || content === '!rank' || content.startsWith('!seviye ') || content.startsWith('!level ') || content.startsWith('!rank ')) {
      const targetUser = message.mentions.users.first() || message.author;
      const targetKey = `${message.guild.id}-${targetUser.id}`;
      const userData = userLevelMap.get(targetKey) || { xp: 0, level: 1 };
      const neededXP = getNeededXP(userData.level);

      const levelEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setAuthor({ name: `${targetUser.username} • Seviye Kartı`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '🏆 Seviye', value: `**${userData.level}**`, inline: true },
          { name: '⭐ Toplam XP', value: `**${userData.xp}** / ${neededXP} XP`, inline: true },
          { name: '📊 İlerleme Durumu', value: createProgressBar(userData.xp, neededXP), inline: false }
        )
        .setFooter({ text: 'K7e • Sohbet ederek sınırsız XP kazanabilirsiniz!' })
        .setTimestamp();

      return message.reply({ embeds: [levelEmbed] });
    }

    if (content === '!liderlik' || content === '!top') {
      const guildUsers = [];
      userLevelMap.forEach((data, key) => {
        if (key.startsWith(`${message.guild.id}-`)) {
          guildUsers.push({ userId: key.split('-')[1], level: data.level, xp: data.xp });
        }
      });

      guildUsers.sort((a, b) => b.level - a.level || b.xp - a.xp);
      const top10 = guildUsers.slice(0, 10);
      let description = '';

      if (top10.length === 0) {
        description = 'Henüz kimsede XP yok. Sohbet etmeye başla!';
      } else {
        top10.forEach((user, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
          description += `${medal} **${index + 1}.** <@${user.userId}> — **Seviye ${user.level}** (${user.xp} XP)\n`;
        });
      }

      const leaderboardEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`🏆 ${message.guild.name} • Seviye Liderlik Tablosu`)
        .setDescription(description)
        .setFooter({ text: 'K7e • Liderlik Sıralaması' })
        .setTimestamp();

      return message.reply({ embeds: [leaderboardEmbed] });
    }
  }

  // Diğer Genel Komutlar
  if (['sa', 's.a', 'selam'].includes(content)) {
    return message.reply(`Aleykümselam ${message.author}! Hoş geldin 👋`);
  }

  // 📜 KURALLAR KOMUTU (Sadeleştirildi)
  if (content === '!kurallar') {
    if (!isAuthorized(message.member)) {
      return message.reply('❌ Bu komutu sadece **Yönetici** veya **Moderatör** rolündekiler kullanabilir.');
    }
    await message.delete().catch(() => {});
    const kurallarEmbed = new EmbedBuilder()
      .setColor('#FFB000')
      .setTitle('👑 SUNUCU KURALLARI')
      .setDescription(
        '• **Kanalları amacı dışında kullanmak yasaktır.**\n\n' +
        '• **Küfür, argo, hakaret ve kışkırtıcı söylemler yasaktır.**\n\n' +
        '• **Özelden veya kanallardan reklam yapmak kesinlikle yasaktır.**\n\n' +
        '• **Spam, flood ve sohbeti bozan davranışlar yasaktır.**\n\n' +
        '• **Din, dil, ırk ve cinsiyet ayrımcılığı yapmak yasaktır.**\n\n' +
        '• **Siyaset yapmak ve tartışma ortamı yaratmak yasaktır.**'
      )
      .setFooter({ text: 'K7e • Kurallar Panosu' })
      .setTimestamp();
    return message.channel.send({ embeds: [kurallarEmbed] });
  }

  if (content === '!yardım' || content === '!help') {
    const channelName = message.channel.name.toLowerCase();
    if (!channelName.includes('bot-komut') && !channelName.includes('botkomut')) {
      const warnMsg = await message.reply('⚠️ `!yardım` komutunu sadece **#bot-komut** kanalında kullanabilirsin!');
      setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
      return;
    }

    const yardımEmbed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🤖 Bot Komut & Sistem Listesi')
      .addFields(
        { name: '🧠 Yapay Zeka', value: 'Beni etiketleyip istediğin soruyu sorabilirsin! (Örn: `@Boom Bot nasılsın?`)' },
        { name: '🎯 Valorant Özellikleri', value: '• `#rastgele-ajan` kanalında butonla rastgele ajan seçimi.\n• `!valohaber` - En son Valorant yamasını/haberini gösterir.\n• Otomatik haberler `#valorant-haberleri` kanalına düşer.' },
        { name: '⭐ Seviye Sistemi (#level-bilgi)', value: '`!seviye` - Seviye kartınızı gösterir.\n`!liderlik` - Sunucu sıralamasını gösterir.' },
        { name: '🛡️ Otomatik Güvenlik & Denetim', value: '• **Mod-Log:** Sunucudaki tüm değişimler kaydedilir.\n• **Küfür Engeli:** Otomatik silinir.\n• **Link Engeli:** Kademeli uyarı/timeout/ban.' },
        { name: '🎮 Eğlence / Bilgi', value: '`!zar`, `!yazıtura`, `!ping`, `!avatar`, `!sunucu`' }
      )
      .setFooter({ text: 'Geliştirici: K7e' })
      .setTimestamp();

    return message.reply({ embeds: [yardımEmbed] });
  }

  if (content === '!ping') return message.reply(`🏓 Pong! ${client.ws.ping}ms`);
  if (content === '!zar') return message.reply(`🎲 Zarı attın ve **${Math.floor(Math.random() * 6) + 1}** geldi!`);
  if (content === '!yazıtura') return message.reply(`Para havaya atıldı... Sonuç: **${Math.random() < 0.5 ? 'Yazı 🪙' : 'Tura 🪙'}**`);

  if (content === '!sunucu') {
    const sunucuEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`🏰 ${message.guild.name} Sunucu Bilgileri`)
      .addFields(
        { name: '👥 Üye Sayısı', value: `${message.guild.memberCount}`, inline: true },
        { name: '🆔 Sunucu ID', value: `${message.guild.id}`, inline: true }
      );
    return message.reply({ embeds: [sunucuEmbed] });
  }

  if (content.startsWith('!avatar')) {
    const user = message.mentions.users.first() || message.author;
    return message.reply(`🖼️ **${user.username}** avatarı:\n${user.displayAvatarURL({ size: 1024, dynamic: true })}`);
  }

  if (content.startsWith('!sil')) {
    if (!isAuthorized(message.member)) return message.reply('❌ Yetkin yok.');
    const miktar = parseInt(message.content.split(' ')[1]);
    if (isNaN(miktar) || miktar < 1 || miktar > 100) return message.reply('⚠️ 1-100 arası sayı girin.');
    await message.channel.bulkDelete(miktar, true);
    const msg = await message.channel.send(`🧹 **${miktar}** mesaj silindi!`);
    setTimeout(() => msg.delete().catch(() => {}), 3000);
  }

  if (content.startsWith('!at')) {
    if (!isAuthorized(message.member)) return message.reply('❌ Yetkin yok.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('⚠️ Kullanıcı etiketleyin!');
    if (!member.kickable) return message.reply('❌ Bu kullanıcıyı atamam.');
    await member.kick();
    return message.reply(`Modern **${member.user.tag}** sunucudan atıldı.`);
  }
});

client.login(process.env.DISCORD_TOKEN);
