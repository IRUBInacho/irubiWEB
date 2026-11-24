/* ==========================================================================
   IRUBI — KINETIC SCROLL & MICRO-INTERACTION ENGINE
   Lenis Smooth Scroll + GSAP 3.12 + ScrollTrigger + Accessible Controls
   ========================================================================== */
(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

    if (hasGSAP) {
        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({ ignoreMobileResize: true });
    }

    // ----------------------------------------------------------------------
    // 1. Lenis Smooth Scroll (Fine-Pointer Desktop Only) + Scroll Velocity Bridge
    // ----------------------------------------------------------------------
    let lenis = null;
    let scrollVelocity = 0;
    const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (!prefersReducedMotion && isFinePointer && typeof window.Lenis !== 'undefined') {
        lenis = new Lenis({
            duration: 1.12,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            touchMultiplier: 1.5
        });

        lenis.on('scroll', (e) => {
            scrollVelocity = e.velocity || 0;
            if (hasGSAP) ScrollTrigger.update();
        });

        if (hasGSAP) {
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = (time) => {
                lenis.raf(time);
                requestAnimationFrame(raf);
            };
            requestAnimationFrame(raf);
        }
    }

    // ----------------------------------------------------------------------
    // 2. Top VU Scroll Progress & Smart Editorial Header
    // ----------------------------------------------------------------------
    const progressBar = document.getElementById('scrollProgressBar');
    const header = document.getElementById('header');
    let lastScrollY = window.scrollY;

    const updateScrollChrome = () => {
        const y = window.scrollY;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, y / maxScroll));

        if (progressBar) {
            progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
        }

        if (header && !document.body.classList.contains('menu-open')) {
            if (y > 180 && y > lastScrollY + 6) {
                header.classList.add('is-hidden');
            } else if (y < lastScrollY - 6 || y <= 120) {
                header.classList.remove('is-hidden');
            }
        }
        lastScrollY = y;
    };

    updateScrollChrome();
    window.addEventListener('scroll', updateScrollChrome, { passive: true });

    // ----------------------------------------------------------------------
    // 3. Mobile Navigation Drawer + Smooth Anchor Navigation
    // ----------------------------------------------------------------------
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const menuToggleLabel = document.getElementById('menuToggleLabel');
    const siteNav = document.querySelector('.site-nav');
    const navBackdrop = document.getElementById('navBackdrop');

    const setMenuState = (isOpen) => {
        if (!siteNav || !mobileMenuBtn) return;
        siteNav.classList.toggle('active', isOpen);
        navBackdrop?.classList.toggle('active', isOpen);
        document.body.classList.toggle('menu-open', isOpen);
        mobileMenuBtn.setAttribute('aria-expanded', String(isOpen));
        mobileMenuBtn.setAttribute('aria-label', isOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación');
        if (menuToggleLabel) menuToggleLabel.textContent = isOpen ? 'CERRAR' : 'MENÚ';
        if (lenis) {
            if (isOpen) lenis.stop();
            else lenis.start();
        }
    };

    mobileMenuBtn?.addEventListener('click', () => {
        setMenuState(!siteNav.classList.contains('active'));
    });

    navBackdrop?.addEventListener('click', () => setMenuState(false));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && siteNav?.classList.contains('active')) {
            setMenuState(false);
            mobileMenuBtn?.focus();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 960 && siteNav?.classList.contains('active')) {
            setMenuState(false);
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            if (!targetId || targetId === '#' || targetId === '#main-content') return;
            const targetEl = document.querySelector(targetId);
            if (!targetEl) return;

            e.preventDefault();
            setMenuState(false);

            const offset = -(header?.offsetHeight || 76);
            if (lenis) {
                lenis.scrollTo(targetEl, { offset, duration: 1.15 });
            } else {
                const top = targetEl.getBoundingClientRect().top + window.scrollY + offset;
                window.scrollTo({
                    top: Math.max(0, top),
                    behavior: prefersReducedMotion ? 'auto' : 'smooth'
                });
            }
        });
    });

    // Navigation Scrollspy with aria-current="location"
    const navLinks = Array.from(document.querySelectorAll('.site-nav a:not(.btn)'));
    const sectionMap = new Map();
    navLinks.forEach((link) => {
        const id = link.getAttribute('href')?.slice(1);
        const sec = id ? document.getElementById(id) : null;
        if (sec) sectionMap.set(sec, link);
    });

    if ('IntersectionObserver' in window && sectionMap.size) {
        const visibleRatios = new Map();
        const spy = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                visibleRatios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0);
            });
            let bestSec = null;
            let bestRatio = 0;
            visibleRatios.forEach((ratio, sec) => {
                if (ratio > bestRatio) {
                    bestRatio = ratio;
                    bestSec = sec;
                }
            });
            navLinks.forEach((l) => l.removeAttribute('aria-current'));
            if (bestSec && sectionMap.has(bestSec)) {
                sectionMap.get(bestSec).setAttribute('aria-current', 'location');
            }
        }, {
            rootMargin: '-22% 0px -55% 0px',
            threshold: [0, 0.15, 0.4]
        });
        sectionMap.forEach((_, sec) => spy.observe(sec));
    }

    // ----------------------------------------------------------------------
    // 4. Velocity-Reactive Dual Kinetic Marquee + WCAG 2.2.2 Pause Control
    // ----------------------------------------------------------------------
    const marqueeBand = document.querySelector('.marquee-band');
    const marqueeRows = Array.from(document.querySelectorAll('.marquee-row'));
    const marqueeToggleBtn = document.getElementById('marqueeToggleBtn');
    let marqueePaused = prefersReducedMotion;
    let marqueeVisible = true;

    const updateMarqueeBtnLabel = () => {
        if (!marqueeToggleBtn) return;
        marqueeToggleBtn.textContent = marqueePaused ? 'Reanudar cinta ▶' : 'Pausar cinta ❚❚';
    };
    updateMarqueeBtnLabel();

    marqueeToggleBtn?.addEventListener('click', () => {
        marqueePaused = !marqueePaused;
        updateMarqueeBtnLabel();
    });

    if ('IntersectionObserver' in window && marqueeBand) {
        const mObs = new IntersectionObserver((entries) => {
            marqueeVisible = entries[0]?.isIntersecting ?? true;
        }, { rootMargin: '200px' });
        mObs.observe(marqueeBand);
    }

    if (marqueeRows.length) {
        const states = marqueeRows.map((row) => ({
            row,
            dir: Number(row.dataset.marqueeDir || 1),
            xPercent: 0
        }));

        const stepMarquee = () => {
            if (!marqueePaused && marqueeVisible) {
                const boost = Math.min(4.5, Math.abs(scrollVelocity) * 0.14);
                const speed = 0.042 + boost * 0.055;
                const skew = Math.max(-5, Math.min(5, scrollVelocity * 0.12));

                states.forEach((st) => {
                    st.xPercent -= speed * st.dir;
                    if (st.xPercent <= -50) st.xPercent += 50;
                    if (st.xPercent > 0) st.xPercent -= 50;
                    st.row.style.transform = `translate3d(${st.xPercent.toFixed(3)}%, 0, 0) skewX(${(skew * st.dir).toFixed(2)}deg)`;
                });
                scrollVelocity *= 0.9;
            }
            requestAnimationFrame(stepMarquee);
        };
        requestAnimationFrame(stepMarquee);
    }

    // ----------------------------------------------------------------------
    // 5. Tactile Magnetic Pull on Interactive Controls (Fine Pointer Only)
    // ----------------------------------------------------------------------
    if (!prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches && hasGSAP) {
        document.querySelectorAll('[data-magnetic]').forEach((el) => {
            const strength = parseFloat(el.dataset.magnetic || '0.22');
            const xTo = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
            const yTo = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });

            el.addEventListener('pointermove', (e) => {
                const rect = el.getBoundingClientRect();
                const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
                const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
                xTo(dx);
                yTo(dy);
            });

            el.addEventListener('pointerleave', () => {
                xTo(0);
                yTo(0);
            });
        });
    }

    // ----------------------------------------------------------------------
    // 6. GSAP + ScrollTrigger Choreography Per Section
    // ----------------------------------------------------------------------
    if (hasGSAP && !prefersReducedMotion) {
        // A. Hero Entrance + Scroll-Scrubbed Visual Parallax & Scale
        const heroLines = document.querySelectorAll('.hero [data-kinetic-lines] .k-line__inner');
        const heroVisualFrame = document.getElementById('heroVisualFrame');
        const heroVisualImg = document.getElementById('heroVisualImg');

        const heroTl = gsap.timeline({ defaults: { ease: 'expo.out' } });
        heroTl
            .from('.hero__meta-row', { opacity: 0, y: 18, duration: 0.8 })
            .from(heroLines, {
                yPercent: 118,
                rotate: 2.2,
                duration: 1.15,
                stagger: 0.09
            }, '-=0.55')
            .from(heroVisualFrame, {
                opacity: 0,
                duration: 1.4,
                ease: 'power2.out'
            }, 0)
            .from('.hero__bottom-deck > *', {
                opacity: 0,
                y: 26,
                duration: 0.9,
                stagger: 0.12
            }, '-=0.6');

        if (heroVisualImg) {
            gsap.fromTo(heroVisualImg,
                { scale: 1.18, yPercent: -4 },
                {
                    scale: 1.02,
                    yPercent: 8,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.hero',
                        start: 'top top',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        }

        // B. Kinetic Display Line Mask Reveals across all subsequent sections
        document.querySelectorAll('section:not(.hero) [data-kinetic-lines]').forEach((heading) => {
            const lines = heading.querySelectorAll('.k-line__inner');
            gsap.from(lines, {
                yPercent: 115,
                rotate: 1.8,
                duration: 1.05,
                stagger: 0.08,
                ease: 'expo.out',
                scrollTrigger: {
                    trigger: heading,
                    start: 'top 86%',
                    once: true
                }
            });
        });

        // C. Generic Subtle Editorial Block Reveals
        document.querySelectorAll('section:not(.hero) [data-reveal-up]').forEach((el) => {
            gsap.from(el, {
                opacity: 0,
                y: 30,
                duration: 0.85,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 88%',
                    once: true
                }
            });
        });

        // D. About Section: Diagonal Clip-Path Wipe + Image Parallax + Scrubbed Manifesto Words
        const clipBox = document.querySelector('[data-clip-reveal]');
        if (clipBox) {
            gsap.fromTo(clipBox,
                { clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)' },
                {
                    clipPath: 'polygon(0% 0%, calc(100% - 44px) 0%, 100% 44px, 100% 100%, 44px 100%, 0% calc(100% - 44px))',
                    duration: 1.2,
                    ease: 'expo.out',
                    scrollTrigger: {
                        trigger: clipBox,
                        start: 'top 82%',
                        once: true
                    }
                }
            );
        }

        const parallaxImg = document.querySelector('[data-parallax-img]');
        if (parallaxImg) {
            gsap.fromTo(parallaxImg,
                { yPercent: -6, scale: 1.14 },
                {
                    yPercent: 6,
                    scale: 1.06,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.about__editorial-grid',
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        }

        const manifestoEl = document.querySelector('[data-scrub-words]');
        if (manifestoEl) {
            const rawText = manifestoEl.textContent.trim().replace(/\s+/g, ' ');
            manifestoEl.innerHTML = rawText
                .split(' ')
                .map((w) => `<span class="scrub-word">${w}</span>`)
                .join(' ');
            const wordSpans = manifestoEl.querySelectorAll('.scrub-word');

            ScrollTrigger.create({
                trigger: manifestoEl,
                start: 'top 82%',
                end: 'bottom 45%',
                scrub: true,
                onUpdate: (self) => {
                    const litCount = Math.round(self.progress * wordSpans.length);
                    wordSpans.forEach((sp, idx) => {
                        sp.classList.toggle('is-lit', idx <= litCount);
                    });
                }
            });
        }

        // E. Services & Process Card Choreography (Desktop vs Mobile Horizontal Tracks)
        const mm = gsap.matchMedia();
        const serviceCards = document.querySelectorAll('.service-chapter');
        const processTrack = document.getElementById('processTrack');
        const processPinWrap = document.getElementById('processPinWrap');
        const processProgressFill = document.getElementById('processProgressFill');

        mm.add('(min-width: 961px)', () => {
            if (serviceCards.length) {
                gsap.from(serviceCards, {
                    opacity: 0,
                    y: 36,
                    duration: 0.85,
                    stagger: 0.1,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity',
                    scrollTrigger: {
                        trigger: '.services__chapters',
                        start: 'top 84%',
                        once: true
                    }
                });
            }

            if (!processTrack || !processPinWrap) return;

            const getScrollAmount = () => {
                return Math.max(0, processTrack.scrollWidth - window.innerWidth + 48);
            };

            gsap.to(processTrack, {
                x: () => -getScrollAmount(),
                ease: 'none',
                scrollTrigger: {
                    trigger: processPinWrap,
                    start: 'top top',
                    end: () => `+=${getScrollAmount() + 320}`,
                    pin: true,
                    scrub: 0.6,
                    invalidateOnRefresh: true,
                    onUpdate: (self) => {
                        if (processProgressFill) {
                            const p = 0.25 + self.progress * 0.75;
                            processProgressFill.style.transform = `scaleX(${p.toFixed(4)})`;
                        }
                    }
                }
            });
        });

        mm.add('(max-width: 960px)', () => {
            if (serviceCards.length) {
                gsap.from(serviceCards, {
                    opacity: 0,
                    x: 24,
                    duration: 0.75,
                    stagger: 0.08,
                    ease: 'power3.out',
                    clearProps: 'transform,opacity',
                    scrollTrigger: {
                        trigger: '.services__chapters',
                        start: 'top 86%',
                        once: true
                    }
                });
            }

            const processCards = document.querySelectorAll('.process-card');
            if (!processCards.length || !processTrack) return;

            gsap.from(processCards, {
                opacity: 0,
                x: 24,
                duration: 0.75,
                stagger: 0.08,
                ease: 'power3.out',
                clearProps: 'transform,opacity',
                scrollTrigger: {
                    trigger: processTrack,
                    start: 'top 88%',
                    once: true
                }
            });
        });

        // G. Portfolio Cards Stagger Reveal
        gsap.from('.release-card', {
            opacity: 0,
            y: 42,
            duration: 0.85,
            stagger: 0.07,
            ease: 'power3.out',
            scrollTrigger: {
                trigger: '.portfolio-grid',
                start: 'top 84%',
                once: true
            }
        });

        // H. CTA Slab Background Parallax + Footer Monumental Wordmark Rise
        gsap.fromTo('.cta-slab__bg',
            { yPercent: -10 },
            {
                yPercent: 10,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.cta-slab',
                    start: 'top bottom',
                    end: 'bottom top',
                    scrub: true
                }
            }
        );

        const footerWordmark = document.querySelector('[data-footer-wordmark]');
        if (footerWordmark) {
            gsap.from(footerWordmark, {
                yPercent: 65,
                opacity: 0.2,
                duration: 1.1,
                ease: 'expo.out',
                scrollTrigger: {
                    trigger: '.site-footer',
                    start: 'top 88%',
                    once: true
                }
            });
        }
    }

    // ----------------------------------------------------------------------
    // 7. Portfolio Filter with Kinetic Re-entry & Live Status Counter
    // ----------------------------------------------------------------------
    const filterButtons = document.querySelectorAll('.filter-btn');
    const portfolioGrid = document.getElementById('portfolioGrid');
    const releaseCards = Array.from(document.querySelectorAll('.release-card'));
    const portfolioStatus = document.getElementById('portfolioStatus');
    const filterLabels = {
        all: 'PROYECTOS',
        production: 'PROYECTOS DE PRODUCCIÓN',
        mixing: 'PROYECTOS DE MEZCLA',
        mastering: 'PROYECTOS DE MASTERING'
    };

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const filter = button.dataset.filter || 'all';

            filterButtons.forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');

            portfolioGrid?.classList.toggle('is-filtered', filter !== 'all');

            const matched = [];
            releaseCards.forEach((card) => {
                const cats = (card.dataset.category || '').split(' ');
                const show = filter === 'all' || cats.includes(filter);
                card.hidden = !show;
                if (show) matched.push(card);
            });

            if (portfolioStatus) {
                const label = filterLabels[filter] || 'PROYECTOS';
                portfolioStatus.textContent = `MOSTRANDO ${matched.length} ${label}`;
            }

            if (hasGSAP && !prefersReducedMotion && matched.length) {
                gsap.fromTo(matched,
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.45, stagger: 0.045, ease: 'expo.out', overwrite: true }
                );
            }
            if (hasGSAP) ScrollTrigger.refresh();
        });
    });

    // ----------------------------------------------------------------------
    // 8. Accessible FAQ Accordion
    // ----------------------------------------------------------------------
    document.querySelectorAll('.faq-question').forEach((question) => {
        question.addEventListener('click', () => {
            const faqItem = question.closest('.faq-item');
            if (!faqItem) return;
            const isActive = faqItem.classList.toggle('active');
            question.setAttribute('aria-expanded', String(isActive));
            if (hasGSAP) {
                setTimeout(() => ScrollTrigger.refresh(), 420);
            }
        });
    });

    // ----------------------------------------------------------------------
    // 9. Post-Interaction Form Validation (:user-invalid + ARIA) & Formspree
    // ----------------------------------------------------------------------
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const submitBtnText = document.getElementById('submitBtnText');
    const formStatus = document.getElementById('formStatus');
    const supportsUserInvalid = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('selector(:user-invalid)');

    if (contactForm) {
        const linkError = (el, shown) => {
            const errorId = el.dataset.error;
            if (!errorId) return;
            const ids = (el.getAttribute('aria-describedby') || '')
                .split(/\s+/)
                .filter((id) => id && id !== errorId);
            if (shown) ids.push(errorId);
            if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
            else el.removeAttribute('aria-describedby');
        };

        const errorAnnouncer = document.createElement('div');
        errorAnnouncer.setAttribute('aria-live', 'polite');
        errorAnnouncer.className = 'visually-hidden';
        document.body.append(errorAnnouncer);
        let announceTimer;
        let announcedField;

        const spokenText = (node) => {
            const copy = node.cloneNode(true);
            copy.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
            copy.querySelectorAll('[role="img"][aria-label]').forEach((n) => n.replaceWith(`${n.getAttribute('aria-label')}: `));
            return copy.textContent.replace(/\s+/g, ' ').trim();
        };

        const announceError = (el) => {
            const errorEl = document.getElementById(el.dataset.error);
            if (!errorEl) return;
            const label = el.labels?.[0] ? `${spokenText(el.labels[0])}: ` : '';
            clearTimeout(announceTimer);
            errorAnnouncer.textContent = '';
            announcedField = el;
            announceTimer = setTimeout(() => {
                errorAnnouncer.textContent = label + spokenText(errorEl);
            }, 500);
        };

        const flaggedFields = new WeakSet();
        const announcedFields = new WeakSet();

        const syncFieldAria = (el, announce = false) => {
            if (!el.matches?.('input, select, textarea') || el.classList.contains('form-honeypot')) return;
            const isInvalid = supportsUserInvalid
                ? el.matches(':user-invalid')
                : el.classList.contains('user-invalid-fallback');

            if (isInvalid) {
                if (announce && !announcedFields.has(el)) {
                    announceError(el);
                    announcedFields.add(el);
                }
                el.setAttribute('aria-invalid', 'true');
                linkError(el, true);
                flaggedFields.add(el);
            } else if (flaggedFields.has(el) || el.getAttribute('aria-invalid') !== 'true') {
                el.setAttribute('aria-invalid', 'false');
                linkError(el, false);
                flaggedFields.delete(el);
                announcedFields.delete(el);
                if (announcedField === el) {
                    clearTimeout(announceTimer);
                    errorAnnouncer.textContent = '';
                }
            }
        };

        contactForm.querySelectorAll('input:not([type="hidden"]):not(.form-honeypot), select, textarea').forEach((el) => {
            el.setAttribute('aria-invalid', 'false');
        });

        contactForm.addEventListener('blur', (e) => syncFieldAria(e.target, true), true);
        contactForm.addEventListener('input', (e) => {
            if (e.target.hasAttribute('aria-invalid')) syncFieldAria(e.target, false);
        });
        contactForm.addEventListener('change', (e) => syncFieldAria(e.target, true), true);
        contactForm.addEventListener('invalid', (e) => {
            announcedFields.add(e.target);
            syncFieldAria(e.target, false);
        }, true);
        contactForm.addEventListener('reset', () => {
            setTimeout(() => {
                [...contactForm.elements].forEach((el) => syncFieldAria(el, false));
            });
        });

        const showFormStatus = (type, text) => {
            if (!formStatus) return;
            formStatus.textContent = text;
            formStatus.className = `form-status form-status--${type}`;
            formStatus.hidden = false;
        };

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!contactForm.reportValidity()) return;

            const endpoint = contactForm.getAttribute('action') || '';
            const name = document.getElementById('name')?.value.trim() || '';
            const service = document.getElementById('service')?.value || '';
            const originalLabel = submitBtnText ? submitBtnText.textContent : 'Enviar consulta';

            if (submitBtn) submitBtn.disabled = true;
            if (submitBtnText) submitBtnText.textContent = 'Enviando…';
            if (formStatus) formStatus.hidden = true;

            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    body: new FormData(contactForm),
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    showFormStatus('success', `¡Gracias ${name}! Tu consulta sobre ${service} ha sido enviada. Me pondré en contacto contigo en menos de 24 horas.`);
                    contactForm.reset();
                } else {
                    const data = await response.json().catch(() => null);
                    const errorDetail = data?.errors?.map((err) => err.message).join(', ');
                    showFormStatus('error', errorDetail || 'No se pudo enviar tu consulta. Intenta nuevamente o escríbeme a irubimusic@gmail.com.');
                }
            } catch {
                showFormStatus('error', 'Error de conexión al enviar el formulario. Revisa tu internet o escríbeme directo a irubimusic@gmail.com.');
            } finally {
                if (submitBtn) submitBtn.disabled = false;
                if (submitBtnText) submitBtnText.textContent = originalLabel;
            }
        });
    }

    // ----------------------------------------------------------------------
    // 10. Mobile & Tablet Horizontal Carousels (Services & Process <= 960px)
    // ----------------------------------------------------------------------
    const mobileCarouselMQ = window.matchMedia('(max-width: 960px)');
    const supportsScrollEnd = 'onscrollend' in window;
    const processProgressEl = document.getElementById('processProgressFill');
    const mobileCarousels = Array.from(document.querySelectorAll('[data-mobile-carousel]'));

    mobileCarousels.forEach((root) => {
        const carouselType = root.dataset.mobileCarousel || '';
        const track = root.querySelector('[data-carousel-track]');
        const prevBtn = root.querySelector('[data-direction="previous"]');
        const nextBtn = root.querySelector('[data-direction="next"]');
        const markersNav = root.querySelector('[data-carousel-markers]');
        const statusEl = root.querySelector('[data-carousel-status]');
        const slides = track ? Array.from(track.children) : [];

        if (!track || !slides.length) return;

        let activeIndex = 0;
        let settledIndex = 0;
        let pendingTargetIndex = null;
        let pendingStartScroll = null;
        let rafPending = false;
        let settleTimer = null;
        let isInitialized = false;

        // Build marker buttons from slide metadata
        const markers = [];
        if (markersNav) {
            markersNav.innerHTML = '';
            slides.forEach((slide, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'mobile-carousel-dot';
                btn.setAttribute('aria-label', slide.dataset.markerName || `Ir a la tarjeta ${idx + 1}`);
                btn.setAttribute('aria-current', idx === 0 ? 'true' : 'false');
                btn.addEventListener('click', () => {
                    if (!mobileCarouselMQ.matches) return;
                    scrollToSlide(idx);
                });
                markersNav.appendChild(btn);
                markers.push(btn);
            });
        }

        const getTrackPaddingStart = () => {
            const style = window.getComputedStyle(track);
            return parseFloat(style.paddingLeft) || 0;
        };

        const getSlideSnapPositions = () => {
            const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
            const trackRect = track.getBoundingClientRect();
            const padStart = getTrackPaddingStart();
            const base = track.scrollLeft - trackRect.left - padStart;
            return {
                maxScroll,
                positions: slides.map((slide) => {
                    const rawLeft = base + slide.getBoundingClientRect().left;
                    return Math.min(maxScroll, Math.max(0, rawLeft));
                })
            };
        };

        const getTargetScrollLeft = (index) => {
            const { positions } = getSlideSnapPositions();
            return positions[index] ?? 0;
        };

        const getNearestSlideIndex = () => {
            const { maxScroll, positions } = getSlideSnapPositions();
            if (maxScroll <= 1) return 0;
            if (track.scrollLeft >= maxScroll - 4) return slides.length - 1;

            const currentLeft = track.scrollLeft;
            let bestIndex = 0;
            let bestDist = Infinity;

            for (let i = 0; i < positions.length; i += 1) {
                const dist = Math.abs(positions[i] - currentLeft);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestIndex = i;
                }
            }
            return bestIndex;
        };

        const updateMarkers = (index) => {
            if (index === activeIndex && isInitialized) return;
            activeIndex = index;
            markers.forEach((marker, idx) => {
                marker.setAttribute('aria-current', idx === index ? 'true' : 'false');
            });
        };

        const syncProcessBar = () => {
            if (carouselType !== 'process' || !processProgressEl || !mobileCarouselMQ.matches) return;
            const maxScroll = Math.max(1, track.scrollWidth - track.clientWidth);
            const ratio = Math.min(1, Math.max(0, track.scrollLeft / maxScroll));
            const scale = 0.25 + ratio * 0.75;
            processProgressEl.style.transform = `scaleX(${scale.toFixed(4)})`;
        };

        const updateButtons = (index) => {
            const atStart = index <= 0;
            const atEnd = index >= slides.length - 1;

            if (prevBtn) {
                const hadFocus = document.activeElement === prevBtn;
                prevBtn.disabled = atStart;
                if (atStart && hadFocus && nextBtn && !nextBtn.disabled) {
                    nextBtn.focus();
                }
            }

            if (nextBtn) {
                const hadFocus = document.activeElement === nextBtn;
                nextBtn.disabled = atEnd;
                if (atEnd && hadFocus && prevBtn && !prevBtn.disabled) {
                    prevBtn.focus();
                }
            }
        };

        const scrollToSlide = (targetIndex) => {
            const clamped = Math.min(slides.length - 1, Math.max(0, targetIndex));
            const targetLeft = getTargetScrollLeft(clamped);

            if (Math.abs(track.scrollLeft - targetLeft) < 2) {
                pendingTargetIndex = null;
                pendingStartScroll = null;
                updateMarkers(clamped);
                updateButtons(clamped);
                return;
            }

            pendingTargetIndex = clamped;
            pendingStartScroll = track.scrollLeft;
            updateMarkers(clamped);

            track.scrollTo({
                left: targetLeft,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });

            if (prefersReducedMotion) {
                pendingTargetIndex = null;
                pendingStartScroll = null;
                handleSettled(true);
            }
        };

        const handleSettled = (announce) => {
            if (!mobileCarouselMQ.matches) return;

            if (
                pendingTargetIndex !== null &&
                pendingStartScroll !== null &&
                Math.abs(track.scrollLeft - pendingStartScroll) < 2
            ) {
                return;
            }

            const nearest = getNearestSlideIndex();
            pendingTargetIndex = null;
            pendingStartScroll = null;

            updateMarkers(nearest);
            updateButtons(nearest);
            syncProcessBar();

            if (announce && nearest !== settledIndex && statusEl) {
                const slideLabel = slides[nearest]?.dataset.slideLabel || `${nearest + 1} de ${slides.length}`;
                statusEl.textContent = `Tarjeta ${slideLabel}`;
            }
            settledIndex = nearest;
            isInitialized = true;
        };

        prevBtn?.addEventListener('click', () => {
            if (!mobileCarouselMQ.matches) return;
            const base = pendingTargetIndex !== null ? pendingTargetIndex : getNearestSlideIndex();
            scrollToSlide(base - 1);
        });

        nextBtn?.addEventListener('click', () => {
            if (!mobileCarouselMQ.matches) return;
            const base = pendingTargetIndex !== null ? pendingTargetIndex : getNearestSlideIndex();
            scrollToSlide(base + 1);
        });

        track.addEventListener('scroll', () => {
            if (!mobileCarouselMQ.matches) return;

            syncProcessBar();

            if (!supportsScrollEnd) {
                clearTimeout(settleTimer);
                settleTimer = setTimeout(() => handleSettled(true), 140);
            }

            if (pendingTargetIndex !== null || rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                if (!mobileCarouselMQ.matches || pendingTargetIndex !== null) return;
                updateMarkers(getNearestSlideIndex());
            });
        }, { passive: true });

        if (supportsScrollEnd) {
            track.addEventListener('scrollend', () => {
                handleSettled(true);
            });
        }

        const syncMode = (isMobile) => {
            if (isMobile) {
                root.setAttribute('role', 'region');
                root.setAttribute('aria-roledescription', 'carousel');
                root.setAttribute('aria-label', root.dataset.carouselLabel || 'Carrusel de tarjetas');
                track.setAttribute('tabindex', '0');
                track.setAttribute('role', 'group');
                track.setAttribute('aria-label', 'Tarjetas');

                slides.forEach((slide, idx) => {
                    slide.setAttribute('role', 'group');
                    slide.setAttribute('aria-roledescription', 'slide');
                    slide.setAttribute('aria-label', slide.dataset.slideLabel || `${idx + 1} de ${slides.length}`);
                });

                isInitialized = false;
                handleSettled(false);
            } else {
                root.removeAttribute('role');
                root.removeAttribute('aria-roledescription');
                root.removeAttribute('aria-label');
                track.removeAttribute('tabindex');
                track.removeAttribute('role');
                track.removeAttribute('aria-label');
                track.scrollLeft = 0;

                slides.forEach((slide) => {
                    slide.removeAttribute('role');
                    slide.removeAttribute('aria-roledescription');
                    slide.removeAttribute('aria-label');
                });

                pendingTargetIndex = null;
                pendingStartScroll = null;
                if (statusEl) statusEl.textContent = '';
            }
        };

        syncMode(mobileCarouselMQ.matches);
        mobileCarouselMQ.addEventListener('change', (e) => syncMode(e.matches));

        let lastViewportWidth = window.innerWidth;
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            if (!mobileCarouselMQ.matches) return;
            // Ignore vertical-only URL bar resizes on mobile scroll
            if (window.innerWidth === lastViewportWidth) return;
            lastViewportWidth = window.innerWidth;
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                syncProcessBar();
                updateButtons(getNearestSlideIndex());
            }, 150);
        });
    });
})();
