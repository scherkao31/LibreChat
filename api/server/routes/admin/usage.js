const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const { User, Message, Balance, Transaction } = require('~/db/models');

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

/** Nombre de jours entre deux cles 'YYYY-MM-DD' (de a vers b). */
function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY_MS);
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

    // Donnees PAR UTILISATEUR (cumul) : nb de messages + jours actifs distincts.
    const perUserAgg = await Message.aggregate([
      { $match: { ...notAdminMsg, createdAt: { $type: 'date' } } },
      { $group: { _id: '$user', count: { $sum: 1 }, days: { $addToSet: dayExpr } } },
    ]);
    const perUser = {};
    perUserAgg.forEach((r) => {
      perUser[r._id] = { count: r.count, dayList: Array.isArray(r.days) ? r.days : [] };
    });

    // Comptes (hors admin) avec date d'inscription + methode (provider), pour cohortes et profils.
    const usersList = await User.find(notAdminUser).select('_id createdAt provider').lean();

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

    // Stickiness : actifs distincts sur 1 / 7 / 30 jours (independant de la periode choisie).
    const distinctActive = async (days) =>
      (
        await Message.distinct('user', {
          ...notAdminMsg,
          createdAt: { $gte: new Date(now.getTime() - days * DAY_MS) },
        })
      ).length;
    const dau = await distinctActive(1);
    const wau = await distinctActive(7);
    const mau = await distinctActive(30);

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
      .select('user tokenCredits')
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

    // === Profils PAR COMPTE (jointure perUser <-> users <-> balances, par id) ===
    const balanceByUser = {};
    balances.forEach((b) => {
      balanceByUser[String(b.user)] =
        typeof b.tokenCredits === 'number' ? b.tokenCredits : START_BALANCE;
    });
    const nowMs = now.getTime();
    const profiles = usersList.map((u) => {
      const id = String(u._id);
      const pu = perUser[id] || { count: 0, dayList: [] };
      const credits = balanceByUser[id] != null ? balanceByUser[id] : START_BALANCE;
      const consumed = Math.max(0, START_BALANCE - credits);
      const signupDay = u.createdAt instanceof Date ? dayKey(u.createdAt) : null;
      // maxOffset = nb de jours entre l'inscription et le DERNIER jour actif (-1 si jamais actif).
      const maxOffset =
        signupDay && pu.dayList.length
          ? Math.max(...pu.dayList.map((d) => dayDiff(signupDay, d)))
          : -1;
      return {
        ageDays: u.createdAt instanceof Date ? (nowMs - u.createdAt.getTime()) / DAY_MS : null,
        provider: u.provider || 'local',
        messages: pu.count,
        activeDays: pu.dayList.length,
        maxOffset,
        consumed,
        usedPct: (consumed / START_BALANCE) * 100,
      };
    });
    const activatedProfiles = profiles.filter((p) => p.messages > 0);
    const activated = activatedProfiles.length;

    // Retention par COHORTE J1/J7/J30 : denominateur = comptes inscrits il y a >= N jours
    // (ceux qui ont eu la chance de revenir) ; retenu = actif a J >= N apres l'inscription.
    const cohort = (n) => {
      const elig = profiles.filter((p) => p.ageDays != null && p.ageDays >= n);
      return { base: elig.length, count: elig.filter((p) => p.maxOffset >= n).length };
    };
    const retention = {
      activated: { base: totalUsers, count: activated },
      j1: cohort(1),
      j7: cohort(7),
      j30: cohort(30),
    };

    // Profondeur d'engagement : repartition des messages par compte activé.
    const engagement = [
      { label: '1 message', test: (m) => m === 1 },
      { label: '2 a 5', test: (m) => m >= 2 && m <= 5 },
      { label: '6 a 20', test: (m) => m >= 6 && m <= 20 },
      { label: '21 a 50', test: (m) => m >= 21 && m <= 50 },
      { label: 'plus de 50', test: (m) => m > 50 },
    ].map((d) => ({
      label: d.label,
      count: activatedProfiles.filter((p) => d.test(p.messages)).length,
    }));

    // Regularite : repartition des jours actifs distincts par compte activé.
    const activeDaysDist = [
      { label: '1 jour', test: (d) => d === 1 },
      { label: '2 a 3 jours', test: (d) => d >= 2 && d <= 3 },
      { label: '4 a 7 jours', test: (d) => d >= 4 && d <= 7 },
      { label: '8 jours et plus', test: (d) => d >= 8 },
    ].map((d) => ({
      label: d.label,
      count: activatedProfiles.filter((p) => d.test(p.activeDays)).length,
    }));

    // Concentration (Pareto) : part du top 10% des comptes activés.
    const shareTop10 = (values) => {
      const sorted = [...values].sort((a, b) => b - a);
      const total = sorted.reduce((s, v) => s + v, 0);
      if (!total) {
        return 0;
      }
      const topN = Math.max(1, Math.ceil(sorted.length * 0.1));
      const topSum = sorted.slice(0, topN).reduce((s, v) => s + v, 0);
      return Math.round((topSum / total) * 100);
    };
    const concentration = {
      topMessagesPct: shareTop10(activatedProfiles.map((p) => p.messages)),
      topCreditsPct: shareTop10(activatedProfiles.map((p) => p.consumed)),
    };

    // Gros consommateurs (plus de 75% du credit) : nouveaux qui bingent ou fideles ?
    const heavy = profiles.filter((p) => p.usedPct > 75);
    const avg = (arr, sel) => (arr.length ? arr.reduce((s, p) => s + sel(p), 0) / arr.length : 0);
    const heavyActive = heavy.filter((p) => p.activeDays > 0);
    const heavyUsers = {
      total: heavy.length,
      byAge: [
        { label: 'moins de 7 jours', test: (a) => a != null && a < 7 },
        { label: '7 a 14 jours', test: (a) => a != null && a >= 7 && a <= 14 },
        { label: 'plus de 14 jours', test: (a) => a != null && a > 14 },
      ].map((d) => ({ label: d.label, count: heavy.filter((p) => d.test(p.ageDays)).length })),
      avgActiveDays: Math.round(avg(heavy, (p) => p.activeDays) * 10) / 10,
      avgMessages: Math.round(avg(heavy, (p) => p.messages)),
      burnPerActiveDay: Math.round(avg(heavyActive, (p) => p.consumed / p.activeDays)),
    };

    // === Methode d'inscription (email/local vs Google) + activation par methode ===
    const methodOf = (prov) =>
      prov === 'google' ? 'Google' : prov === 'local' ? 'Email' : 'Autre';
    const methodMap = {};
    profiles.forEach((p) => {
      const m = methodOf(p.provider);
      if (!methodMap[m]) {
        methodMap[m] = { signups: 0, activated: 0 };
      }
      methodMap[m].signups += 1;
      if (p.messages > 0) {
        methodMap[m].activated += 1;
      }
    });
    const signupMethods = ['Email', 'Google', 'Autre']
      .filter((m) => methodMap[m])
      .map((m) => ({ label: m, signups: methodMap[m].signups, activated: methodMap[m].activated }));

    // === BLOC 3 : activation approfondie + regle d'or ===
    // Activation PROFONDE = revenu un 2e jour ET au moins 3 messages.
    const deepActivation = {
      base: totalUsers,
      count: profiles.filter((p) => p.maxOffset >= 1 && p.messages >= 3).length,
    };
    // Regle d'or : les comptes profondement actives retiennent-ils >= 2x mieux a J7 ?
    const elig7 = profiles.filter((p) => p.ageDays != null && p.ageDays >= 7);
    const isDeep = (p) => p.maxOffset >= 1 && p.messages >= 3;
    const deep7 = elig7.filter(isDeep);
    const shallow7 = elig7.filter((p) => !isDeep(p));
    const rateJ7 = (arr) =>
      arr.length ? arr.filter((p) => p.maxOffset >= 7).length / arr.length : 0;
    const deepRate = rateJ7(deep7);
    const shallowRate = rateJ7(shallow7);
    const goldenRule = {
      deepBase: deep7.length,
      shallowBase: shallow7.length,
      deepJ7Pct: Math.round(deepRate * 100),
      shallowJ7Pct: Math.round(shallowRate * 100),
      ratio: shallowRate > 0 ? Math.round((deepRate / shallowRate) * 10) / 10 : null,
    };

    const median = (arr) => {
      if (!arr.length) {
        return 0;
      }
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    };

    // Time to value : delai MEDIAN entre l'inscription et le 3e message (en heures).
    const usersById = {};
    usersList.forEach((u) => {
      usersById[String(u._id)] = u.createdAt instanceof Date ? u.createdAt.getTime() : null;
    });
    const thirdMsgAgg = await Message.aggregate([
      { $match: { ...notAdminMsg, createdAt: { $type: 'date' } } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$user', msgs: { $push: '$createdAt' } } },
      { $project: { third: { $arrayElemAt: ['$msgs', 2] } } },
    ]);
    const ttvHours = [];
    thirdMsgAgg.forEach((r) => {
      const signup = usersById[r._id];
      if (r.third && signup != null) {
        const h = (new Date(r.third).getTime() - signup) / 3600000;
        if (h >= 0) {
          ttvHours.push(h);
        }
      }
    });
    const timeToValue = {
      base: ttvHours.length,
      medianHours: Math.round(median(ttvHours) * 10) / 10,
    };

    // === BLOC 4 : stickiness + power users ===
    const stickiness = {
      dau,
      wau,
      mau,
      dauMau: mau ? Math.round((dau / mau) * 100) : 0,
      wauMau: mau ? Math.round((wau / mau) * 100) : 0,
    };
    const totalMsgSum = activatedProfiles.reduce((s, p) => s + p.messages, 0);
    // Power user = plus de 75% du credit consomme OU plus de 50 messages.
    const power = activatedProfiles.filter((p) => p.usedPct > 75 || p.messages > 50);
    const powerMsgSum = power.reduce((s, p) => s + p.messages, 0);
    const powerUsers = {
      count: power.length,
      pctOfActivated: activated ? Math.round((power.length / activated) * 100) : 0,
      sharePct: totalMsgSum ? Math.round((powerMsgSum / totalMsgSum) * 100) : 0,
      medianMessages: Math.round(median(activatedProfiles.map((p) => p.messages))),
    };

    // === BLOC 2 (conversion) + BLOC 6 (revenu) via les transactions de credits ===
    // Un payant = >=1 transaction tokenType 'credits' (octroi du backend Stripe). Isole dans un
    // try/catch : si la collection/les champs different, on renvoie null sans casser le reste.
    let conversion = null;
    let revenue = null;
    try {
      const PRICE_CHF = 17;
      const grants = await Transaction.find({
        ...(meId ? { user: { $ne: meId } } : {}),
        tokenType: 'credits',
      })
        .select('user tokenValue rawAmount createdAt')
        .lean();

      // 1ere conversion par compte (date + plan via le montant : >=10M = premium, sinon pro).
      const conv = {};
      grants.forEach((g) => {
        const amount = Math.max(Number(g.tokenValue) || 0, Number(g.rawAmount) || 0);
        if (amount <= 0 || !g.createdAt) {
          return;
        }
        const id = String(g.user);
        const ts = new Date(g.createdAt).getTime();
        if (!conv[id] || ts < conv[id].date) {
          conv[id] = { date: ts, plan: amount >= 10000000 ? 'premium' : 'pro' };
        }
      });
      const converterIds = Object.keys(conv);
      const paidCount = converterIds.length;

      // Conso du gratuit AVANT conversion = somme des |tokenValue| de depense avant la date.
      const converterObjIds = grants.filter((g) => conv[String(g.user)]).map((g) => g.user);
      const spend = paidCount
        ? await Transaction.find({
            user: { $in: converterObjIds },
            tokenType: { $in: ['prompt', 'completion'] },
          })
            .select('user tokenValue createdAt')
            .lean()
        : [];
      const spentBefore = {};
      spend.forEach((s) => {
        const id = String(s.user);
        const c = conv[id];
        if (c && s.createdAt && new Date(s.createdAt).getTime() < c.date) {
          spentBefore[id] = (spentBefore[id] || 0) + Math.abs(Number(s.tokenValue) || 0);
        }
      });

      const ttcDays = [];
      const consoAtConv = [];
      let exhaustedConverters = 0;
      converterIds.forEach((id) => {
        const signup = usersById[id];
        if (signup != null) {
          ttcDays.push((conv[id].date - signup) / DAY_MS);
        }
        const pct = Math.min(100, ((spentBefore[id] || 0) / START_BALANCE) * 100);
        consoAtConv.push(pct);
        if (pct >= 90) {
          exhaustedConverters += 1;
        }
      });

      // Conversion par cohorte mensuelle d'inscription.
      const monthKey = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
      const cohorts = {};
      usersList.forEach((u) => {
        if (!(u.createdAt instanceof Date)) {
          return;
        }
        const k = monthKey(u.createdAt.getTime());
        if (!cohorts[k]) {
          cohorts[k] = { signups: 0, converted: 0 };
        }
        cohorts[k].signups += 1;
        if (conv[String(u._id)]) {
          cohorts[k].converted += 1;
        }
      });
      const byCohort = Object.keys(cohorts)
        .sort()
        .map((k) => ({ month: k, signups: cohorts[k].signups, converted: cohorts[k].converted }));

      // Au mur : non-payants a >=90% du gratuit (solde courant) + payants ayant epuise avant de payer.
      const nonConverterAtWall = profiles.filter((p) => p.usedPct >= 90).length;
      const atWallTotal = nonConverterAtWall + exhaustedConverters;

      conversion = {
        paidCount,
        rate: totalUsers ? Math.round((paidCount / totalUsers) * 1000) / 10 : 0,
        byPlan: {
          pro: converterIds.filter((id) => conv[id].plan === 'pro').length,
          premium: converterIds.filter((id) => conv[id].plan === 'premium').length,
        },
        medianTimeToConvDays: Math.round(median(ttcDays) * 10) / 10,
        medianConsoAtConvPct: Math.round(median(consoAtConv)),
        atWall: {
          total: atWallTotal,
          converted: exhaustedConverters,
          rate: atWallTotal ? Math.round((exhaustedConverters / atWallTotal) * 1000) / 10 : 0,
        },
        byCohort,
      };

      // BLOC 6 : revenu (ESTIMATION, suppose tous les payants encore actifs ; sans statut d'abonnement).
      revenue = {
        payants: paidCount,
        mrrEstime: paidCount * PRICE_CHF,
        arpu:
          totalUsers ? Math.round(((paidCount * PRICE_CHF) / totalUsers) * 100) / 100 : 0,
        prixMensuel: PRICE_CHF,
      };
    } catch (convErr) {
      logger.warn(`[admin/usage] conversion/revenu indisponible : ${convErr.message}`);
    }

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
      retention,
      conversion,
      revenue,
      deepActivation,
      goldenRule,
      timeToValue,
      signupMethods,
      stickiness,
      powerUsers,
      engagement,
      activeDays: activeDaysDist,
      concentration,
      heavyUsers,
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
