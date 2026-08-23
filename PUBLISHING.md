# دليل النشر — Google Play و App Store

---

## ١) قبل أي شيء: غيّر هذه الأشياء

| الملف | ما تغيّره |
|---|---|
| `capacitor.config.json` | `appId` → معرّف نطاقك العكسي، مثال `com.yourstudio.critterclash` (لا يمكن تغييره بعد النشر!) |
| `capacitor.config.json` | `appName` → اسم اللعبة المعروض |
| `www/js/ads.js` | معرّفات AdMob الحقيقية و `USE_TEST_ADS = false` |
| `www/js/main.js` | (اختياري) احذف كتلة `CCDEBUG` |
| `package.json` | `version` |

بعد أي تغيير: `npx cap sync`

---

## ٢) أندرويد — Google Play

### التجهيز
```bash
npm install
npx cap add android
npx cap sync
npx cap open android          # يفتح Android Studio
```

### الأيقونة وشاشة البداية
```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --android
```
يقرأ الأمر `resources/icon.png` و `resources/splash.png` (مولّدة بالفعل) وينشئ كل المقاسات.

### إعدادات مهمّة في `android/app/build.gradle`
```gradle
defaultConfig {
    applicationId "com.yourstudio.critterclash"
    minSdkVersion 23
    targetSdkVersion 35          // مطلوب من Google Play
    versionCode 1                // زِدها بواحد مع كل رفع
    versionName "1.0.0"
}
```

### قفل الوضع الرأسي
في `android/app/src/main/AndroidManifest.xml` داخل `<activity>`:
```xml
android:screenOrientation="portrait"
```

### مفتاح التوقيع (احتفظ به للأبد — فقدانه يعني فقدان التطبيق)
```bash
keytool -genkey -v -keystore critterclash.keystore \
  -alias critterclash -keyalg RSA -keysize 2048 -validity 10000
```
ثم في Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle (.aab)**.

### الرفع
1. [Google Play Console](https://play.google.com/console) — رسوم تسجيل ٢٥ دولاراً مرة واحدة.
2. **Create app** → الاسم، اللغة، «Game»، «Free».
3. ارفع ملف `.aab` في **Testing → Internal testing** أولاً وجرّبه على جهازك.
4. أكمل: Store listing، Content rating، Target audience، **Data safety**، Ads declaration، Privacy policy URL.
5. **Production → Create release → Review → Start rollout**.

⚠️ حساب جديد من نوع «فردي» يحتاج **١٢ مختبِراً لمدة ١٤ يوماً** في Closed testing قبل السماح بالنشر العام.

---

## ٣) iOS — App Store

يتطلّب **جهاز Mac + Xcode** وحساب [Apple Developer](https://developer.apple.com) بـ ٩٩ دولاراً سنوياً.

```bash
npx cap add ios
npx capacitor-assets generate --ios
npx cap sync
npx cap open ios
```

في Xcode:
1. **Signing & Capabilities** → اختر فريقك، وتأكد من `Bundle Identifier`.
2. **General → Deployment Info** → Portrait فقط، iOS 14.0+.
3. أضف في `Info.plist` مفتاح `NSUserTrackingUsageDescription` (مطلوب مع الإعلانات).
4. **Product → Archive** ثم **Distribute App → App Store Connect**.
5. في [App Store Connect](https://appstoreconnect.apple.com): املأ البيانات، **App Privacy**، ثم **Submit for Review**.

---

## ٤) نصوص المتجر الجاهزة

### 🇸🇦 عربي

**الاسم (٣٠ حرفاً):**
`صدام المخلوقات: نقر وتطوير`

**الوصف القصير (٨٠ حرفاً):**
`انقر، اجمع مخلوقات، طوّرها، واسحق الزعماء — تتقدّم حتى وأنت نائم!`

**الوصف الكامل:**
```
🐾 صدام المخلوقات — لعبة النقر والتفريم التي لا تتوقف!

انقر لتضرب الوحوش، اجمع الذهب، وجنّد فريقاً من المخلوقات الغريبة التي تقاتل عنك
تلقائياً… حتى وأنت خارج اللعبة تماماً.

⚔️ اللعب
• انقر لتوجّه ضربات ساحقة وضربات حرجة
• ١٢ مخلوقاً فريداً — كل واحد بأسلوب قتال وشكل مختلف
• مكافأة ضرر ×٢ عند كل مستوى مميّز لمخلوقاتك
• زعيم ضخم كل ٥ مراحل… وأمامك ٣٠ ثانية فقط لهزيمته!
• ١٠ عوالم مختلفة: غابة الفطر، كهوف البلور، رمال الجحيم، العدم…

⬆️ التطوير اللانهائي
• ترقيات للبطل: ضرر، ضربات حرجة، ذهب، ضربة مزدوجة
• ٥ مهارات قتالية بأزمنة انتظار
• نظام البعث: ابدأ من جديد أقوى بعشرات المرات
• آثار أبدية تُشترى بالأرواح ولا تُفقد أبداً
• ٢٦ إنجازاً تمنحك جواهر

😴 تتقدّم وأنت نائم
فريقك يواصل القتال أثناء غيابك ويجمع الغنائم — عُد واستلم أرباحك!

✨ مميزات
• عربي وإنجليزي بالكامل
• بدون إنترنت — العبها في أي مكان
• حجم صغير جداً وأداء سلس
• إعلانات اختيارية فقط للمكافآت — لا شيء يقاطع لعبك

حمّلها الآن وابدأ رحلتك من المرحلة ١ إلى ما لا نهاية!
```

**الكلمات المفتاحية:** `لعبة نقر, تفريم, خاملة, وحوش, مخلوقات, تطوير, بدون نت, ابطال, زعماء`

---

### 🇬🇧 English

**Name (30):** `Critter Clash: Idle Tap RPG`

**Short description (80):** `Tap, collect critters, crush bosses — your squad keeps farming while you sleep!`

**Full description:**
```
🐾 CRITTER CLASH — the idle tapper that never stops farming!

Tap to smash monsters, collect gold, and recruit a squad of bizarre critters
that fight for you automatically — even when the app is closed.

⚔️ BATTLE
• Tap for massive hits and critical strikes
• 12 unique critters, each with its own look and damage style
• ×2 damage milestones at every key critter level
• A giant BOSS every 5 stages — beat the 30-second timer!
• 10 hand-tuned worlds: Mushroom Woods, Crystal Caves, Ember Sands, The Void…

⬆️ ENDLESS PROGRESSION
• Hero upgrades: damage, crit, gold, double hits
• 5 active battle skills on cooldowns
• Prestige for Souls — restart dramatically stronger
• 10 Eternal Relics bought with Souls, never lost
• 26 achievements that pay out gems

😴 IDLE PROGRESS
Your squad keeps fighting while you're away. Come back and collect.

✨ FEATURES
• Full Arabic & English support
• 100% offline — play anywhere
• Tiny download, buttery-smooth performance
• Optional rewarded ads only — nothing interrupts your run

Download now and climb from Stage 1 to infinity!
```

**Keywords:** `idle,clicker,tap,rpg,monster,critter,offline,incremental,boss,upgrade`

---

## ٥) تصنيف المحتوى وبيانات الخصوصية

**تصنيف المحتوى:** مناسب للجميع / Everyone (عنف كرتوني خفيف جداً).

**Data safety (Google Play) / App Privacy (Apple):**

| السؤال | الإجابة |
|---|---|
| هل تجمع اللعبة بيانات؟ | نعم — عبر AdMob فقط |
| ما نوعها؟ | Device or other IDs، Approximate location (تقريبي من IP)، App interactions |
| لماذا؟ | Advertising or marketing، Analytics |
| هل تُشارك مع طرف ثالث؟ | نعم — Google AdMob |
| هل تُشفَّر أثناء النقل؟ | نعم |
| هل يمكن للمستخدم طلب الحذف؟ | نعم (عبر البريد في سياسة الخصوصية) |
| Contains ads؟ | **نعم** — لا تنسَ تفعيل هذا الخيار |

> **إن أزلت الإعلانات نهائياً:** تصبح الإجابة «لا يتم جمع أي بيانات»، لأن كل الحفظ محلي على الجهاز.

**سياسة الخصوصية:** استخدم `PRIVACY.md` — ارفعه على GitHub Pages أو أي استضافة مجانية وضع الرابط في المتجرين (إجباري).

---

## ٦) الأصول الجاهزة في هذه الحزمة

| الملف | الاستخدام |
|---|---|
| `resources/icon.png` (1024×1024) | أيقونة التطبيق للمتجرين |
| `resources/icon-foreground.png` / `icon-background.png` | أيقونة أندرويد التكيّفية |
| `resources/splash.png` (2732×2732) | شاشة البداية |
| `resources/feature-graphic.png` (1024×500) | Feature graphic إجباري في Google Play |
| `shots/v-*.png` (780×1688) | لقطات الشاشة — تحتاج ٢ على الأقل في Play و ٣ في App Store |

لإعادة توليدها: `node tools/make-icons.js` و `node tools/shots.js`.

---

## ٧) قائمة تحقق أخيرة قبل الرفع

- [ ] `appId` نهائي ولن يتغيّر
- [ ] `USE_TEST_ADS = false` ومعرّفات AdMob حقيقية
- [ ] `versionCode` / `versionName` مرفوعان
- [ ] جُرّبت على جهاز حقيقي (أندرويد + iOS)
- [ ] الوضع الرأسي مقفل
- [ ] زر الرجوع في أندرويد يعمل (مطبّق مسبقاً)
- [ ] الحفظ يصمد بعد إغلاق التطبيق تماماً
- [ ] رابط سياسة الخصوصية يعمل
- [ ] خانة «Contains ads» مفعّلة
- [ ] ملف keystore محفوظ في مكان آمن + نسخة احتياطية
