/*
 * Shared diagnostic module — client baseline report fallback.
 *
 * Used for degraded/legacy report bundles when the backend report is missing
 * localized rich copy. Data-only: language and label generation are passed in.
 */
(function (global) {
    var PNShared = (global.PNShared = global.PNShared || {});
    var diagnostic = (PNShared.diagnostic = PNShared.diagnostic || {});

    var AXIS_UI = {
        ru: {
            emotions: {
                title: 'Эмоциональный контакт',
                weak: 'Сейчас сложнее удерживать спокойный диалог, когда чувства накаляются. Это не провал — сигнал беречь разговоры и выбирать удачный момент.',
                strong: 'В теме чувств и эмоциональной безопасности у вас уже есть опора — на неё можно опираться, когда разговор становится напряжённым.',
            },
            boundaries: {
                title: 'Личные границы',
                weak: 'Подросток активнее заявляет о своём пространстве и домашних правилах — здесь легко сорваться на взаимные обиды. Помогает формат «я слышу тебя → вместе ищем вариант».',
                strong: 'В домашних договорённостях уже есть рабочие точки — их можно усилить, а не перестраивать с нуля.',
            },
            autonomy: {
                title: 'Автономия и самостоятельность',
                weak: 'Ребёнку сейчас особенно важно отделяться и принимать свои решения, а взрослому — бережно отпускать контроль. Сопротивление здесь часто про взросление, не про неуважение.',
                strong: 'Вы уже даёте подростку зоны выбора и ответственности — это снижает скрытое сопротивление и укрепляет доверие.',
            },
        },
        en: {
            emotions: {
                title: 'Emotional contact',
                weak: 'It is harder right now to stay calm when feelings run high. That is not failure — it is a signal to protect conversations and pick the right moment.',
                strong: 'You already have ground in emotional safety — you can lean on that when talks get tense.',
            },
            boundaries: {
                title: 'Personal boundaries',
                weak: 'Your teen is asserting space and house rules more actively — mutual hurt is easy here. A “I hear you → we look for a shared option” format helps.',
                strong: 'House agreements already have working points — you can strengthen them instead of rebuilding from scratch.',
            },
            autonomy: {
                title: 'Autonomy and independence',
                weak: 'Your teen needs to separate and make their own choices; your job is to release control gently. Pushback here is often about growing up, not disrespect.',
                strong: 'You already offer zones of choice and responsibility — that lowers hidden resistance and builds trust.',
            },
        },
        es: {
            emotions: {
                title: 'Contacto emocional',
                weak: 'Ahora cuesta más mantener la calma cuando las emociones se intensifican. No es un fracaso: es una señal para cuidar las conversaciones y elegir el momento adecuado.',
                strong: 'Ya tienes apoyo en la seguridad emocional — puedes apoyarte en ello cuando la conversación se tensa.',
            },
            boundaries: {
                title: 'Límites personales',
                weak: 'Tu hijo defiende más su espacio y las reglas de casa — aquí es fácil herirse mutuamente. Ayuda el formato «te escucho → buscamos una opción juntos».',
                strong: 'En los acuerdos de casa ya hay puntos que funcionan — puedes reforzarlos en lugar de reconstruir todo desde cero.',
            },
            autonomy: {
                title: 'Autonomía e independencia',
                weak: 'A tu hijo le importa separarse y tomar sus propias decisiones; tu tarea es soltar el control con cuidado. La resistencia aquí suele ser crecimiento, no falta de respeto.',
                strong: 'Ya ofreces zonas de elección y responsabilidad — eso reduce la resistencia oculta y fortalece la confianza.',
            },
        },
        fr: {
            emotions: {
                title: 'Contact émotionnel',
                weak: 'Il est plus difficile en ce moment de rester calme quand les émotions montent. Ce n\'est pas un échec — c\'est un signal pour protéger les échanges et choisir le bon moment.',
                strong: 'Vous avez déjà un appui en sécurité émotionnelle — vous pouvez vous y appuyer quand la conversation se tend.',
            },
            boundaries: {
                title: 'Limites personnelles',
                weak: 'Votre adolescent revendique davantage son espace et les règles à la maison — les blessures mutuelles sont faciles ici. Le format « je t\'entends → on cherche une option ensemble » aide.',
                strong: 'Les accords à la maison ont déjà des points qui fonctionnent — vous pouvez les renforcer plutôt que tout reconstruire.',
            },
            autonomy: {
                title: 'Autonomie et indépendance',
                weak: 'Votre adolescent a besoin de se distinguer et de faire ses choix ; votre rôle est de lâcher le contrôle avec douceur. La résistance ici relève souvent de la croissance, pas du manque de respect.',
                strong: 'Vous offrez déjà des zones de choix et de responsabilité — cela réduit la résistance cachée et renforce la confiance.',
            },
        },
        zh: {
            emotions: {
                title: '情感连接',
                weak: '当情绪升高时，现在更难保持冷静。这不是失败——这是提醒你要保护对话、选对时机。',
                strong: '你在情感安全方面已有支撑——当谈话变得紧张时，可以依靠这一点。',
            },
            boundaries: {
                title: '个人边界',
                weak: '孩子更积极地争取自己的空间和家规——这里很容易互相伤害。「我听见你→我们一起找方案」的格式会有帮助。',
                strong: '家里的约定里已经有可行的点——你可以加强它们，而不是从零重建。',
            },
            autonomy: {
                title: '自主与独立',
                weak: '孩子现在特别需要分离并做自己的选择；你的任务是温和地放手控制。这里的抵抗往往是成长，而不是不尊重。',
                strong: '你已经提供了选择与责任的区域——这会降低隐性抵抗并增强信任。',
            },
        },
    };

    var TEMPLATES = {
        ru: {
            headline: 'Ваш результат готов',
            short_term_plan: '7–14 дней: по одному короткому разговору в день «без оценок»; одно совместное правило с объяснением «зачем»; одна микро-зона выбора для подростка — как эксперимент, а не как исправление.',
            long_term_plan: '2–3 месяца: стабильные я-высказывания вместо ультиматума; церемония «мы против задачи» в спорах; регулярная отметка усилий, не только результатов — чтобы укреплять связь, а не «учить».',
            expert_insight: 'Бытовые конфликты с подростком чаще связаны не с «ленью» или «вредностью», а с обострённым страхом контроля и поиском собственной опоры. Когда доверие временно проседает, сопротивление усиливается — это естественная динамика взросления, а не приговор.',
            priority_plan: [
                'Сегодня: 10 минут разговора без советов — только «что для тебя сейчас самое тяжёлое».',
                'Сегодня: одно правило оформить как «описание своей позиции / выслушать другую — затем третий вариант».',
                'Сегодня: одна похвала за усилие (не за оценку), привязанная к конкретному действию.',
            ],
            four_d: { X: 'X3_Goal — согласовать цель контакта', Y_prefix: 'Шкала напряжения продукта:', M: 'M2_Psychophysiology + M3_Cognition — эмоции и ясность формулировок', Role: 'Взрослый как союзник и навигатор, не как прокурор' },
            mirror: {
                high: 'Ваш пульс отношений — {hp}%. Это хороший маркер: в семье есть крепкая основа, но в отдельных темах контакт сейчас хрупкий. Сам факт, что вы прошли тест, — уже про заботу о связи.',
                mid: 'Ваш пульс отношений — {hp}%. В целом вы слышите друг друга, но в некоторых темах общение становится напряжённым. Это ориентир для следующих шагов, а не оценка вас как родителя.',
                low: 'Ваш пульс отношений — {hp}%. Сейчас связь под нагрузкой — чаще из‑за истощённого ресурса, а не из‑за «плохого воспитания». То, что вы здесь, уже говорит о заботе об отношениях.',
            },
        },
        en: {
            headline: 'Your result is ready',
            short_term_plan: '7–14 days: one short non-judgemental conversation a day; one shared rule with a “why”; one safe micro-choice as an experiment, not as a fix.',
            long_term_plan: '2–3 months: steady “I-statements” instead of ultimatums; the “us vs. the problem” stance in disputes; noticing effort, not only results.',
            expert_insight: 'Everyday conflict with a teen is more often about fear of losing control and the search for their own ground than about laziness or bad will. When trust dips, resistance grows — natural dynamics of adolescence, not a sentence.',
            priority_plan: [
                'Today: 10 minutes of conversation without advice — just “what feels hardest right now”.',
                'Today: turn one rule into “describe your position / hear the other — then look for a third option”.',
                'Today: one praise for effort (not result) tied to a concrete action.',
            ],
            four_d: { X: 'X3_Goal — align the goal of contact', Y_prefix: 'Product tension scale:', M: 'M2_Psychophysiology + M3_Cognition — emotions and clarity of wording', Role: 'Adult as ally and navigator, not as prosecutor' },
            mirror: {
                high: 'Your relationship pulse is {hp}%. That is a clear marker: there is a strong foundation, but some topics make contact fragile right now. Taking this check-up is already an act of care.',
                mid: 'Your relationship pulse is {hp}%. You generally hear each other, but tension shows up in some topics. This is an orientation for next steps, not a verdict on you as a parent.',
                low: 'Your relationship pulse is {hp}%. The bond is under load right now — often about exhausted resources, not coldness. The fact that you are here already shows care for the relationship.',
            },
        },
        es: {
            headline: 'Tu resultado está listo',
            short_term_plan: '7–14 días: una conversación breve al día «sin juzgar»; una regla compartida con su «por qué»; una micro-zona de elección para el adolescente, como experimento y no como corrección.',
            long_term_plan: '2–3 meses: mensajes en primera persona en lugar de ultimátums; la postura «nosotros frente al problema» en las disputas; reconocer el esfuerzo, no solo el resultado — para fortalecer el vínculo, no para «enseñar».',
            expert_insight: 'El conflicto cotidiano con un adolescente tiene que ver más con el miedo a perder el control y la búsqueda de su propio apoyo que con la «pereza» o la «mala voluntad». Cuando la confianza baja, la resistencia crece — es una dinámica natural de la adolescencia, no una sentencia.',
            priority_plan: [
                'Hoy: 10 minutos de conversación sin consejos — solo «qué es lo más difícil para ti ahora mismo».',
                'Hoy: convierte una regla en «describo mi postura / escucho la tuya — luego buscamos una tercera opción».',
                'Hoy: un elogio por el esfuerzo (no por el resultado), ligado a una acción concreta.',
            ],
            four_d: { X: 'X3_Goal — alinear el objetivo del contacto', Y_prefix: 'Escala de tensión del producto:', M: 'M2_Psychophysiology + M3_Cognition — emociones y claridad de las palabras', Role: 'El adulto como aliado y navegante, no como fiscal' },
            mirror: {
                high: 'Tu pulso de la relación es {hp}%. Es una buena señal: hay una base sólida, aunque en algunos temas el contacto está frágil ahora. El hecho de hacer este test ya habla de tu cuidado por el vínculo.',
                mid: 'Tu pulso de la relación es {hp}%. En general os escucháis, pero en algunos temas la comunicación se tensa. Es una orientación para los próximos pasos, no un veredicto sobre ti como madre o padre.',
                low: 'Tu pulso de la relación es {hp}%. Ahora el vínculo está bajo presión — más por recursos agotados que por frialdad. Que estés aquí ya muestra tu cuidado por la relación.',
            },
        },
        fr: {
            headline: 'Votre résultat est prêt',
            short_term_plan: '7–14 jours : une courte conversation par jour « sans jugement » ; une règle partagée avec un « pourquoi » ; une micro-zone de choix pour l\'adolescent, comme une expérience et non comme une correction.',
            long_term_plan: '2–3 mois : des messages en « je » plutôt que des ultimatums ; la posture « nous face au problème » dans les disputes ; valoriser l\'effort, pas seulement le résultat — pour renforcer le lien, pas pour « éduquer ».',
            expert_insight: 'Le conflit quotidien avec un adolescent tient plus à la peur de perdre le contrôle et à la recherche de ses propres appuis qu\'à la « paresse » ou la « mauvaise volonté ». Quand la confiance baisse, la résistance grandit — c\'est une dynamique naturelle de l\'adolescence, pas un verdict.',
            priority_plan: [
                'Aujourd\'hui : 10 minutes de conversation sans conseils — juste « qu\'est-ce qui est le plus dur pour toi en ce moment ».',
                'Aujourd\'hui : transformez une règle en « je décris ma position / j\'écoute la tienne — puis on cherche une troisième option ».',
                'Aujourd\'hui : un compliment pour l\'effort (pas pour le résultat), lié à une action concrète.',
            ],
            four_d: { X: 'X3_Goal — aligner l\'objectif du contact', Y_prefix: 'Échelle de tension du produit :', M: 'M2_Psychophysiology + M3_Cognition — émotions et clarté des formulations', Role: 'L\'adulte comme allié et guide, non comme procureur' },
            mirror: {
                high: 'Votre pouls relationnel est de {hp}%. C\'est un bon repère : il y a une base solide, mais sur certains sujets le contact est fragile en ce moment. Faire ce bilan témoigne déjà de votre soin pour le lien.',
                mid: 'Votre pouls relationnel est de {hp}%. Dans l\'ensemble vous vous entendez, mais sur certains sujets la communication se tend. C\'est un repère pour les prochaines étapes, pas un verdict sur vous en tant que parent.',
                low: 'Votre pouls relationnel est de {hp}%. Le lien est sous tension en ce moment — souvent par épuisement des ressources, pas par froideur. Le fait d\'être ici témoigne déjà de votre soin pour la relation.',
            },
        },
        zh: {
            headline: '你的结果已准备好',
            short_term_plan: '7–14 天：每天一次简短的「不评判」对话；一条带「为什么」的共同规则；给孩子一个微小的选择空间——作为尝试，而不是纠正。',
            long_term_plan: '2–3 个月：用「我」式表达代替最后通牒；争执时采用「我们一起面对问题」的立场；肯定努力而不只是结果——是为了加强连接，而不是为了「教育」。',
            expert_insight: '与青少年的日常冲突，往往与失控的恐惧和寻找自我支撑有关，而不是「懒惰」或「故意」。当信任暂时下降，抵抗就会增强——这是青春期的自然动态，而不是判决。',
            priority_plan: [
                '今天：10 分钟不给建议的对话——只问「现在对你来说最难的是什么」。',
                '今天：把一条规则变成「我说明我的立场／听你的立场——然后一起找第三种方案」。',
                '今天：为努力（而非结果）的一次具体行动给予一句肯定。',
            ],
            four_d: { X: 'X3_Goal — 对齐沟通的目标', Y_prefix: '产品张力量表：', M: 'M2_Psychophysiology + M3_Cognition — 情绪与表达的清晰度', Role: '成年人作为盟友和向导，而非检察官' },
            mirror: {
                high: '你的关系脉搏是 {hp}%。这是一个好的标志：你们有牢固的基础，但在某些话题上，当下的连接比较脆弱。你做这次检测，本身就体现了对关系的用心。',
                mid: '你的关系脉搏是 {hp}%。总体上你们能彼此倾听，但在某些话题上沟通会变得紧张。这是下一步的参考，而不是对你作为父母的评判。',
                low: '你的关系脉搏是 {hp}%。此刻关系正承受压力——更多是因为资源耗尽，而非冷漠。你出现在这里，已经说明你在用心维护这段关系。',
            },
        },
    };

    function clampPercent(value, fallback) {
        var n = typeof value === 'number' ? value : parseInt(String(value != null ? value : ''), 10);
        if (!Number.isFinite(n)) n = fallback;
        return Math.max(0, Math.min(100, n));
    }

    function axisKeysFromNegatives(negs, mode) {
        var axes = [];
        (negs || []).forEach(function (row) {
            var ax = String((row && row.axis) || '').trim();
            if (ax && axes.indexOf(ax) === -1) axes.push(ax);
        });
        if (mode === 'weak') return axes;
        var all = ['emotions', 'boundaries', 'autonomy'];
        return all.filter(function (k) { return axes.indexOf(k) === -1; });
    }

    var AXIS_EMPTY = {
        weak: {
            ru: '• Сейчас напряжение распределено неравномерно — это нормально. Поддержка в «узких» местах обычно даёт максимум эффекта без давления на всю семью.',
            en: '• Tension is unevenly spread right now — that is normal. Support in the narrow spots usually brings the biggest effect without pressuring the whole family.',
            es: '• La tensión está repartida de forma desigual — es normal. Apoyar en los puntos débiles suele dar el mayor efecto sin presionar a toda la familia.',
            fr: '• La tension est inégalement répartie — c\'est normal. Soutenir les points sensibles apporte souvent le plus d\'effet sans pression sur toute la famille.',
            zh: '• 紧张感分布不均——这很正常。在薄弱处给予支持，通常能在不施压全家的前提下带来最大效果。',
        },
        strong: {
            ru: '• У вас уже есть надёжный фундамент в нескольких сферах семейной жизни — интуитивно чувствуете, где ребёнку нужна безопасность, и это ваш главный ресурс.',
            en: '• You already have a reliable foundation in several areas of family life — you sense where your teen needs safety, and that is your main resource.',
            es: '• Ya tienes una base sólida en varias áreas de la vida familiar — intuyes dónde tu hijo necesita seguridad, y ese es tu principal recurso.',
            fr: '• Vous avez déjà une base solide dans plusieurs domaines de la vie familiale — vous sentez où votre enfant a besoin de sécurité, et c\'est votre ressource principale.',
            zh: '• 你在家庭生活的多个方面已有可靠基础——你能直觉感受到孩子需要安全的地方，这是你的主要资源。',
        },
    };

    function normalizeLoc(raw) {
        var s = String(raw || '').toLowerCase();
        if (s.indexOf('ru') === 0) return 'ru';
        if (s.indexOf('es') === 0) return 'es';
        if (s.indexOf('fr') === 0) return 'fr';
        if (s.indexOf('zh') === 0) return 'zh';
        return 'en';
    }

    function formatAxisBullets(keys, loc, mode) {
        var ui = AXIS_UI[loc] || AXIS_UI.en || AXIS_UI.ru;
        var hintKey = mode === 'weak' ? 'weak' : 'strong';
        var empty = AXIS_EMPTY[mode === 'weak' ? 'weak' : 'strong'];
        if (!keys || !keys.length) return empty[loc] || empty.en;
        var lines = [];
        keys.forEach(function (key) {
            var block = ui[key];
            if (!block) return;
            lines.push('• ' + block.title + ': ' + block[hintKey]);
        });
        return lines.length ? lines.join('\n') : (empty[loc] || empty.en);
    }

    function fallbackMirror(hp, loc) {
        var tpl = TEMPLATES[loc] || TEMPLATES.en;
        var band = hp >= 68 ? 'high' : hp >= 48 ? 'mid' : 'low';
        return String(tpl.mirror[band]).replace('{hp}', hp);
    }

    function buildBaselineReport(raw, options) {
        raw = raw && typeof raw === 'object' ? raw : {};
        options = options || {};
        var rep0 = raw.report && typeof raw.report === 'object' ? raw.report : {};
        var role = String(raw.respondent_role || 'parent').toLowerCase() === 'teen' ? 'teen' : 'parent';
        // Prefer explicit locale; fall back to legacy isEn flag.
        var loc = options.locale ? normalizeLoc(options.locale) : (options.isEn ? 'en' : 'ru');
        var tpl = TEMPLATES[loc] || TEMPLATES.en;
        var fallbackHealth = diagnostic.helpers && diagnostic.helpers.fallbackHealthPercent
            ? diagnostic.helpers.fallbackHealthPercent(raw.y_level)
            : 50;
        var hp = clampPercent(rep0.relationship_health_percent, fallbackHealth);
        var resPct = clampPercent(rep0.resource_level_percent, 50);
        var negs = Array.isArray(raw.negative_substantive_answers) ? raw.negative_substantive_answers : [];
        var weakKeys = axisKeysFromNegatives(negs, 'weak');
        var strongKeys = axisKeysFromNegatives(negs, 'strong');
        var yLevel = String(raw.y_level || '');
        var base = Object.assign({}, rep0);
        var healthLabel = typeof options.healthLabel === 'function'
            ? options.healthLabel
            : function () { return ''; };

        base.headline = tpl.headline;
        base.mirror_paragraph = fallbackMirror(hp, loc);
        base.superpowers = formatAxisBullets(strongKeys, loc, 'strong');
        base.growth_zones = formatAxisBullets(weakKeys, loc, 'weak');
        base.short_term_plan = tpl.short_term_plan;
        base.long_term_plan = tpl.long_term_plan;
        base.expert_insight = tpl.expert_insight;
        base.priority_plan = tpl.priority_plan.slice();
        base.relationship_health_label = healthLabel(hp, !!raw.safety_mode, role);
        base.four_d_snapshot = {
            X: tpl.four_d.X,
            Y: tpl.four_d.Y_prefix + ' ' + yLevel,
            M: tpl.four_d.M,
            Role: tpl.four_d.Role,
        };
        base.relationship_health_percent = hp;
        base.resource_level_percent = resPct;
        base.degraded_report = true;
        return base;
    }

    diagnostic.reportFallback = {
        buildBaselineReport: buildBaselineReport,
    };
})(typeof window !== 'undefined' ? window : this);
