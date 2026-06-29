const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { User, Message, Balance } = require('~/db/models');

const router = express.Router();

// Reserve a l'admin produit : SEUL ce compte voit les statistiques d'usage, et il est EXCLU
// des calculs (on ne veut pas compter la consommation / les messages du compte de test).
const ADMIN_EMAIL = 'salim@genevia.io';
const TZ = 'Europe/Zurich';
// Credit gratuit offert a l'inscription (cf librechat.yaml -> balance.startBalance).
const START_BALANCE = 1000000;
const DAY_MS = 86400000;

router.use(requireJwtAuth, (req, res, next) => {
  if (String(req.user?.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

/** Cle de jour 'YYYY-MM-DD' dans le fuseau suisse (alignee sur le $dateToString Mongo). */
function dayKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Liste continue de cles de jour de startKey a endKey inclus (bornee a 400 jours). */
function daysBetween(startKey, endKey) {
  const out = [];
  const d = new Date(`${startKey}T12:00:00Z`);
  const end = new Date(`${endKey}T12:00:00Z`);
  let guard = 0;
  while (d <= end && guard < 400) {
    out.push(dayKey(d));
    d.setUTCDate(d.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TZ } };

router.get('/', async (req, res) => {
  try {
    const period = ['7d', '30d', 'all'].includes(req.query.period) ? req.query.period : '30d';
    const now = new Date();
    const todayKey = dayKey(now);

    const me = await User.findOne({ email: ADMIN_EMAIL }).select('_id').lean();
    const meId = me?._id;
    const meStr = meId ? meId.toString() : '';

    const notAdminUser = { email: { $ne: ADMIN_EMAIL } };
    // message.user est une STRING (l'id hex), d'ou le $ne sur la chaine.
    const notAdminMsg = { isCreatedByUser: true, user: { $ne: meStr } };

    // Fenetre de periode : since = borne basse (null pour "tout").
    const since =
      period === '7d'
        ? new Date(now.getTime() - 6 * DAY_MS)
        : period === '30d'
          ? new Date(now.getTime() - 29 * DAY_MS)
          : null;

    // Inscriptions (cumul).
    const totalUsers = await User.countDocuments(notAdminUser);

    // Activation + retention (cumul) : jours distincts d'activite par compte.
    const ret = (
      await Message.aggregate([
        { $match: { ...notAdminMsg, createdAt: { $type: 'date' } } },
        { $group: { _id: { u: '$user', d: dayExpr } } },
        { $group: { _id: '$_id.u', days: { $sum: 1 } } },
        {
          $group: {
            _id: null,
            activated: { $sum: 1 },
            ret2: { $sum: { $cond: [{ $gte: ['$days', 2] }, 1, 0] } },
            ret3: { $sum: { $cond: [{ $gte: ['$days', 3] }, 1, 0] } },
          },
        },
      ])
    )[0] || { activated: 0, ret2: 0, ret3: 0 };

    // Messages par jour (filtre periode).
    const msgMatch = since
      ? { ...notAdminMsg, createdAt: { $gte: since } }
      : { ...notAdminMsg, createdAt: { $type: 'date' } };
    const msgByDay = await Message.aggregate([
      { $match: msgMatch },
      { $group: { _id: dayExpr, c: { $sum: 1 } } },
    ]);
    const msgMap = {};
    msgByDay.forEach((r) => {
      msgMap[r._id] = r.c;
    });
    const messagesInPeriod = msgByDay.reduce((s, r) => s + r.c, 0);

    // Actifs sur la periode (comptes distincts avec au moins un message).
    const activeInPeriod = (await Message.distinct('user', msgMatch)).length;

    // Nouveaux inscrits par jour (tous), puis affichage filtre sur la periode.
    const signupByDay = await User.aggregate([
      { $match: { ...notAdminUser, createdAt: { $type: 'date' } } },
      { $group: { _id: dayExpr, c: { $sum: 1 } } },
    ]);
    const signupMap = {};
    signupByDay.forEach((r) => {
      signupMap[r._id] = r.c;
    });
    const newToday = signupMap[todayKey] || 0;

    // Bornes des courbes (continues, trous combles a 0).
    let startKey;
    if (since) {
      startKey = dayKey(since);
    } else {
      const firstKeys = [...Object.keys(signupMap), ...Object.keys(msgMap)].sort();
      startKey = firstKeys[0] || todayKey;
    }
    const windowDays = daysBetween(startKey, todayKey);
    const messagesDaily = windowDays.map((k) => ({ date: k, count: msgMap[k] || 0 }));
    const signupsDaily = windowDays.map((k) => ({ date: k, count: signupMap[k] || 0 }));
    const signupsInPeriod = signupsDaily.reduce((s, r) => s + r.count, 0);

    // Consommation des credits (etat courant via balances).
    const balances = await Balance.find(meId ? { user: { $ne: meId } } : {})
      .select('tokenCredits')
      .lean();
    const bucketDefs = [
      { label: '0 a 25%', min: 0, max: 25 },
      { label: '25 a 50%', min: 25, max: 50 },
      { label: '50 a 75%', min: 50, max: 75 },
      { label: '75 a 90%', min: 75, max: 90 },
      { label: 'plus de 90%', min: 90, max: Infinity },
    ];
    const buckets = bucketDefs.map((b) => ({ label: b.label, count: 0 }));
    let consumedTotal = 0;
    let nearLimit = 0;
    balances.forEach((b) => {
      const credits = typeof b.tokenCredits === 'number' ? b.tokenCredits : START_BALANCE;
      const used = Math.max(0, START_BALANCE - credits);
      consumedTotal += used;
      const pct = (used / START_BALANCE) * 100;
      if (pct >= 90) {
        nearLimit += 1;
      }
      let idx = bucketDefs.findIndex((d) => pct >= d.min && pct < d.max);
      if (idx === -1) {
        idx = buckets.length - 1;
      }
      buckets[idx].count += 1;
    });

    const activated = ret.activated || 0;
    return res.status(200).json({
      period,
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        activated,
        activationPct: totalUsers ? Math.round((activated / totalUsers) * 100) : 0,
        newToday,
        activeInPeriod,
      },
      retention: { base: totalUsers, ret2: ret.ret2 || 0, ret3: ret.ret3 || 0 },
      messages: {
        inPeriod: messagesInPeriod,
        perActiveUser: activeInPeriod
          ? Math.round((messagesInPeriod / activeInPeriod) * 10) / 10
          : 0,
        daily: messagesDaily,
      },
      signups: { inPeriod: signupsInPeriod, daily: signupsDaily },
      tokens: { startBalance: START_BALANCE, consumedTotal, nearLimit, buckets },
    });
  } catch (error) {
    logger.error('[admin/usage] error', error);
    return res.status(500).json({ error: 'usage_stats_failed' });
  }
});

module.exports = router;
