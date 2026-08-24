/* ============================================================
   Critter Clash Idle — bilingual strings (AR / EN)
   ============================================================ */
(function (global) {
  'use strict';
  const CC = global.CC || (global.CC = {});

  const STR = {
    /* --- shell / tabs --- */
    game_title: { ar: 'صدام المخلوقات', en: 'Critter Clash' },
    tab_battle: { ar: 'المعركة', en: 'Battle' },
    tab_critters: { ar: 'المخلوقات', en: 'Critters' },
    tab_upgrades: { ar: 'الترقيات', en: 'Upgrades' },
    tab_prestige: { ar: 'البعث', en: 'Prestige' },
    tab_more: { ar: 'المزيد', en: 'More' },

    /* --- HUD --- */
    gold: { ar: 'ذهب', en: 'Gold' },
    gems: { ar: 'جواهر', en: 'Gems' },
    souls: { ar: 'أرواح', en: 'Souls' },
    stage: { ar: 'المرحلة', en: 'Stage' },
    dps: { ar: 'ضرر/ث', en: 'DPS' },
    tap_dmg: { ar: 'ضرر النقرة', en: 'Tap DMG' },
    boss: { ar: 'الزعيم', en: 'BOSS' },
    kills: { ar: 'قتلى', en: 'Kills' },
    best_stage: { ar: 'أفضل مرحلة', en: 'Best stage' },

    /* --- battle --- */
    tap_to_attack: { ar: 'انقر للهجوم!', en: 'Tap to attack!' },
    boss_escaped: { ar: 'هرب الزعيم! حاول مجدداً', en: 'The boss escaped! Try again' },
    stage_cleared: { ar: 'تم اجتياز المرحلة', en: 'Stage cleared' },
    new_record: { ar: 'رقم قياسي جديد!', en: 'New record!' },
    fight_boss: { ar: 'تحدَّ الزعيم', en: 'Fight boss' },
    retry_boss: { ar: 'إعادة تحدي الزعيم', en: 'Retry boss' },
    auto_advance: { ar: 'تقدم تلقائي', en: 'Auto advance' },
    crit: { ar: 'حرج!', en: 'CRIT!' },

    /* --- critters --- */
    critters_title: { ar: 'فريقك', en: 'Your Squad' },
    hire: { ar: 'تجنيد', en: 'Hire' },
    level_short: { ar: 'مستوى', en: 'Lv' },
    dps_each: { ar: 'ضرر/ث', en: 'DPS' },
    locked_at: { ar: 'يُفتح في المرحلة', en: 'Unlocks at stage' },
    next_milestone: { ar: 'التالي', en: 'Next' },
    milestone_x2: { ar: 'مضاعفة الضرر', en: 'Damage ×2' },
    buy_1: { ar: 'شراء ١', en: 'Buy 1' },
    buy_10: { ar: 'شراء ١٠', en: 'Buy 10' },
    buy_100: { ar: 'شراء ١٠٠', en: 'Buy 100' },
    buy_max: { ar: 'الأقصى', en: 'MAX' },
    maxed: { ar: 'مكتمل', en: 'MAX' },

    /* --- upgrades --- */
    upgrades_title: { ar: 'ترقيات البطل', en: 'Hero Upgrades' },
    skills_title: { ar: 'المهارات', en: 'Skills' },
    ready: { ar: 'جاهزة', en: 'Ready' },
    active: { ar: 'نشطة', en: 'Active' },

    /* --- prestige --- */
    prestige_title: { ar: 'البعث', en: 'Prestige' },
    prestige_desc: {
      ar: 'ابدأ من جديد من المرحلة ١ واحتفظ بالأرواح والآثار. كل روح تمنحك +١٠٪ ضرراً دائماً.',
      en: 'Restart from stage 1 but keep your Souls and Relics. Each Soul grants +10% permanent damage.'
    },
    souls_on_reset: { ar: 'أرواح عند البعث', en: 'Souls on reset' },
    do_prestige: { ar: 'ابعث الآن', en: 'Prestige now' },
    prestige_need: { ar: 'تحتاج المرحلة ١٠ على الأقل', en: 'Reach stage 10 first' },
    confirm_prestige: { ar: 'هل أنت متأكد؟ ستفقد الذهب والمخلوقات والترقيات.', en: 'Are you sure? You will lose gold, critters and upgrades.' },
    relics_title: { ar: 'الآثار الأبدية', en: 'Eternal Relics' },
    relics_desc: { ar: 'ترقيات دائمة تُشترى بالأرواح ولا تُفقد أبداً.', en: 'Permanent upgrades bought with Souls. Never lost.' },
    prestige_count: { ar: 'مرات البعث', en: 'Prestiges' },
    soul_bonus: { ar: 'مكافأة الأرواح', en: 'Soul bonus' },

    /* --- more tab --- */
    achievements: { ar: 'الإنجازات', en: 'Achievements' },
    stats: { ar: 'الإحصائيات', en: 'Stats' },
    settings: { ar: 'الإعدادات', en: 'Settings' },
    language: { ar: 'اللغة', en: 'Language' },
    sound: { ar: 'الصوت', en: 'Sound' },
    music: { ar: 'الموسيقى', en: 'Music' },
    haptics: { ar: 'الاهتزاز', en: 'Vibration' },
    reduce_fx: { ar: 'تقليل المؤثرات', en: 'Reduce effects' },
    on: { ar: 'تشغيل', en: 'On' },
    off: { ar: 'إيقاف', en: 'Off' },
    save_now: { ar: 'حفظ الآن', en: 'Save now' },
    saved: { ar: 'تم الحفظ', en: 'Saved' },
    reset_game: { ar: 'مسح كل البيانات', en: 'Erase all data' },
    reset_confirm: { ar: 'سيتم حذف كل التقدم نهائياً. متأكد؟', en: 'This deletes all progress permanently. Sure?' },
    export_save: { ar: 'تصدير الحفظ', en: 'Export save' },
    import_save: { ar: 'استيراد الحفظ', en: 'Import save' },
    import_prompt: { ar: 'الصق كود الحفظ:', en: 'Paste your save code:' },
    import_ok: { ar: 'تم الاستيراد بنجاح', en: 'Save imported' },
    import_bad: { ar: 'كود حفظ غير صالح', en: 'Invalid save code' },
    copied: { ar: 'تم النسخ', en: 'Copied' },
    credits: { ar: 'اللعبة من صنع فريقك — إصدار', en: 'Built by your studio — version' },

    /* --- stats labels --- */
    st_total_gold: { ar: 'إجمالي الذهب', en: 'Total gold earned' },
    st_total_taps: { ar: 'إجمالي النقرات', en: 'Total taps' },
    st_total_kills: { ar: 'إجمالي القتلى', en: 'Monsters slain' },
    st_bosses: { ar: 'زعماء مهزومون', en: 'Bosses defeated' },
    st_playtime: { ar: 'وقت اللعب', en: 'Play time' },
    st_crit_hits: { ar: 'ضربات حرجة', en: 'Critical hits' },
    st_ads: { ar: 'إعلانات شوهدت', en: 'Ads watched' },

    /* --- rewards / ads --- */
    free_reward: { ar: 'مكافأة مجانية', en: 'Free reward' },
    watch_ad: { ar: 'شاهد إعلاناً', en: 'Watch ad' },
    ad_x2_gold: { ar: 'ذهب ×٢ لمدة ٣٠ دقيقة', en: '×2 gold for 30 min' },
    ad_x2_dps: { ar: 'ضرر ×٢ لمدة ١٥ دقيقة', en: '×2 damage for 15 min' },
    ad_gems: { ar: 'احصل على ٢٥ جوهرة', en: 'Get 25 gems' },
    ad_chest: { ar: 'صندوق مجاني', en: 'Free chest' },
    ad_loading: { ar: 'جارٍ تحميل الإعلان…', en: 'Loading ad…' },
    ad_failed: { ar: 'الإعلان غير متاح الآن', en: 'No ad available right now' },
    ad_reward_given: { ar: 'تم منح المكافأة!', en: 'Reward granted!' },
    boost_active: { ar: 'معزّز نشط', en: 'Boost active' },
    souls_earned: { ar: 'أرواح البعث', en: 'Prestige Souls' },
    double_it: { ar: 'ضاعفها ×٢', en: 'Double it ×2' },
    double_ad_note: {
      ar: 'شاهد إعلاناً قصيراً واحصل على ضعف الأرواح. اختياري تماماً — أرواحك محفوظة في الحالتين.',
      en: 'Watch a short ad for double Souls. Totally optional — your Souls are already safe.'
    },
    no_thanks: { ar: 'لا شكراً', en: 'No thanks' },
    doubled: { ar: 'تمت المضاعفة!', en: 'Doubled!' },
    chest_title: { ar: 'صندوق مجاني كل ٣٠ د', en: 'Free chest every 30m' },
    open_chest: { ar: 'افتح', en: 'Open' },
    you_got: { ar: 'حصلت على', en: 'You got' },

    /* --- offline --- */
    welcome_back: { ar: 'أهلاً بعودتك!', en: 'Welcome back!' },
    offline_earned: { ar: 'فريقك قاتل أثناء غيابك وجمع:', en: 'Your squad kept fighting and collected:' },
    offline_time: { ar: 'مدة الغياب', en: 'Time away' },
    collect: { ar: 'استلام', en: 'Collect' },
    collect_x2: { ar: 'استلام ×٢ (إعلان)', en: 'Collect ×2 (ad)' },

    /* --- arena --- */
    tab_arena: { ar: 'الحلبة', en: 'Arena' },
    trophies: { ar: 'الكؤوس', en: 'Trophies' },
    power_rating: { ar: 'قوة الفريق', en: 'Team power' },
    rivals_title: { ar: 'خصوم متاحون', en: 'Available rivals' },
    my_team_code: { ar: '📋 كود فريقي', en: '📋 My team code' },
    fight_friend: { ar: '⚔️ قتال بكود صديق', en: '⚔️ Fight a friend' },
    fight: { ar: 'قتال', en: 'Fight' },
    code_copied: { ar: 'تم نسخ الكود — أرسله لصديقك!', en: 'Code copied — send it to a friend!' },
    paste_code: { ar: 'الصق كود فريق صديقك:', en: "Paste your friend's team code:" },
    bad_code: { ar: 'الكود غير صالح', en: 'That code is not valid' },
    you: { ar: 'أنت', en: 'You' },
    victory: { ar: 'انتصار!', en: 'VICTORY!' },
    defeat: { ar: 'هزيمة', en: 'DEFEAT' },
    battle_again: { ar: 'قتال آخر', en: 'Battle again' },
    back_to_arena: { ar: 'رجوع للحلبة', en: 'Back to arena' },
    skip: { ar: 'تخطي ⏩', en: 'Skip ⏩' },
    record: { ar: 'السجل', en: 'Record' },
    wins: { ar: 'انتصارات', en: 'Wins' },
    losses: { ar: 'هزائم', en: 'Losses' },
    streak: { ar: 'سلسلة', en: 'Streak' },
    need_team: { ar: 'جنّد مخلوقاً واحداً على الأقل لدخول الحلبة', en: 'Hire at least one critter to enter the arena' },
    your_name: { ar: 'اسمك', en: 'Your name' },
    rival_easy: { ar: 'سهل', en: 'Easy' },
    rival_even: { ar: 'متكافئ', en: 'Even' },
    rival_hard: { ar: 'بطل', en: 'Champion' },
    daily_gem_cap: { ar: 'وصلت لحد الجواهر اليومي', en: 'Daily gem cap reached' },

    /* --- online multiplayer --- */
    online_attack: { ar: '🎯 هجوم أونلاين', en: '🎯 Online attack' },
    find_opponent: { ar: 'ابحث عن خصم', en: 'Find opponent' },
    searching: { ar: 'جارٍ البحث…', en: 'Searching…' },
    no_opponents: { ar: 'لا يوجد خصوم بنفس المستوى حالياً', en: 'No opponents at your level right now' },
    online_label: { ar: 'أونلاين', en: 'Online' },
    friends_section: { ar: '👥 الأصدقاء', en: '👥 Friends' },
    add_friend: { ar: 'إضافة صديق', en: 'Add friend' },
    friend_code: { ar: 'كود الصديق', en: 'Friend code' },
    your_code: { ar: 'كودك', en: 'Your code' },
    enter_code: { ar: 'أدخل كود صديقك', en: "Enter friend's code" },
    friend_added: { ar: 'تمت إضافة الصديق!', en: 'Friend added!' },
    friend_not_found: { ar: 'الكود غير موجود', en: 'Code not found' },
    friend_self: { ar: 'هذا كودك أنت!', en: "That's your own code!" },
    cannot_fight_self: { ar: 'لا يمكنك قتال نفسك!', en: 'You cannot fight yourself!' },
    already_friend: { ar: 'هذا الشخص صديقك بالفعل', en: 'Already friends' },
    attack_friend: { ar: 'هجوم', en: 'Attack' },
    remove_friend: { ar: 'حذف', en: 'Remove' },
    no_friends: { ar: 'لا يوجد أصدقاء — أضف أصدقاء بالكود!', en: 'No friends yet — add friends by code!' },
    defense_log: { ar: '🛡️ سجل الدفاع', en: '🛡️ Defense log' },
    attacked_you_won: { ar: 'هاجمك وفاز!', en: 'attacked you and won!' },
    attacked_you_lost: { ar: 'هاجمك وخسر!', en: 'attacked you and lost!' },
    defended_ok: { ar: 'دافعت بنجاح ✓', en: 'Defended ✓' },
    defended_fail: { ar: 'تم اختراق دفاعك ✗', en: 'Defense breached ✗' },
    no_attacks: { ar: 'لم يهاجمك أحد بعد', en: 'No attacks yet' },
    clear_log: { ar: 'مسح السجل', en: 'Clear log' },
    online_off: { ar: 'غير متصل', en: 'Offline' },
    connecting: { ar: 'جارٍ الاتصال…', en: 'Connecting…' },
    copy_code: { ar: 'نسخ الكود', en: 'Copy code' },
    share_code: { ar: 'شارك كودك مع أصدقائك!', en: 'Share your code with friends!' },
    real_player: { ar: 'لاعب حقيقي', en: 'Real player' },
    network_error: { ar: 'خطأ في الاتصال', en: 'Network error' },

    /* --- google sign-in --- */
    google_signin: { ar: '🔑 تسجيل الدخول بـ Google', en: '🔑 Sign in with Google' },
    google_linked: { ar: 'حساب Google مربوط ✓', en: 'Google account linked ✓' },
    google_link_desc: { ar: 'ربط حسابك يضمن عدم ضياع تقدمك عند تغيير الجهاز.', en: 'Link your account to save progress across devices.' },
    google_signout: { ar: 'تسجيل خروج', en: 'Sign out' },
    google_success: { ar: 'تم ربط حساب Google بنجاح!', en: 'Google account linked successfully!' },
    google_failed: { ar: 'تعذر تسجيل الدخول بـ Google', en: 'Could not sign in with Google' },

    /* --- tap damage & offline penalty --- */
    tap_damage_hint:    { ar: '👆 انقر على وحوش الخصم لإلحاق ضرر إضافي! (+{dmg})', en: '👆 Tap enemy to deal extra damage! (+{dmg} DMG)' },
    offline_drain_hint: { ar: '⚠️ الخصم غير متصل — وحوشك تخسر {drain} HP/ثانية', en: '⚠️ Opponent offline — team loses {drain} HP/s' },

    /* --- mutation lab --- */
    mut_lab: { ar: 'مختبر الطفرات', en: 'Mutation Lab' },
    mut_intro: {
      ar: 'حوّل مخلوقك إلى نسخة فريدة: ندرة جديدة، صفة خاصة، وشكل لا يملكه أحد غيرك. الطفرات تبقى بعد البعث.',
      en: 'Rewrite a critter into something unique: new rarity, a special trait, and a body nobody else owns. Mutations survive prestige.'
    },
    mutate: { ar: 'طفّر', en: 'Mutate' },
    current: { ar: 'الحالي', en: 'Current' },
    new_roll: { ar: 'الجديد', en: 'New' },
    keep_new: { ar: 'احتفظ بالجديد', en: 'Keep new' },
    keep_current: { ar: 'ابقِ الحالي', en: 'Keep current' },
    no_mutation: { ar: 'بلا طفرة', en: 'Unmutated' },
    rarity: { ar: 'الندرة', en: 'Rarity' },
    trait: { ar: 'الصفة', en: 'Trait' },
    element: { ar: 'العنصر', en: 'Element' },
    need_gems: { ar: 'جواهر غير كافية', en: 'Not enough gems' },
    mut_kept: { ar: 'تم تثبيت الطفرة!', en: 'Mutation locked in!' },

    /* --- generic --- */
    close: { ar: 'إغلاق', en: 'Close' },
    cancel: { ar: 'إلغاء', en: 'Cancel' },
    confirm: { ar: 'تأكيد', en: 'Confirm' },
    unlocked: { ar: 'مفتوح', en: 'Unlocked' },
    locked: { ar: 'مغلق', en: 'Locked' },
    reward: { ar: 'المكافأة', en: 'Reward' },
    claim: { ar: 'استلم', en: 'Claim' },
    claimed: { ar: 'مُستلم', en: 'Claimed' },
    cost: { ar: 'التكلفة', en: 'Cost' },
    owned: { ar: 'مملوك', en: 'Owned' },
    per_second: { ar: '/ث', en: '/s' },
    not_enough: { ar: 'المبلغ غير كافٍ', en: 'Not enough' }
  };

  let lang = 'ar';

  function t(key, vars) {
    const entry = STR[key];
    let s = entry ? (entry[lang] || entry.en || key) : key;
    if (vars) {
      for (const k in vars) s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    }
    return s;
  }

  /** Localised name/desc from a data object holding {ar,en} pairs. */
  function tl(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[lang] || obj.en || '';
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body && document.body.classList.toggle('rtl', lang === 'ar');
  }

  function getLang() { return lang; }

  CC.i18n = { t, tl, setLang, getLang, STR };
})(window);
