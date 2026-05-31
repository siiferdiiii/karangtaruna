document.addEventListener('DOMContentLoaded', function() {
    // ── Navbar scroll effect ──────────────────────────────────────
    const navbar = document.getElementById('navbar');

    // On beranda (fullscreen hero), keep navbar always transparent
    // On other pages, make navbar solid immediately
    const isHomePage = document.getElementById('hero-slider') !== null;

    function handleScroll() {
        if (!navbar) return;
        if (isHomePage) {
            // Homepage: transparent always (hero is fullscreen)
            // Optionally add slight darkening after scroll passes hero
            if (window.scrollY > window.innerHeight - 100) {
                navbar.classList.add('nav-solid');
            } else {
                navbar.classList.remove('nav-solid');
            }
        } else {
            // Other pages: always solid dark navbar
            navbar.classList.add('nav-solid');
        }
    }

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Apply on load

    // ── Sidebar Toggle ─────────────────────────────────────────────
    const sidebar        = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarOpen    = document.getElementById('sidebar-open');
    const sidebarClose   = document.getElementById('sidebar-close');

    function openSidebar() {
        if (!sidebar) return;
        sidebar.classList.add('sidebar-open');
        sidebarOverlay.classList.add('sidebar-overlay-open');
        document.body.style.overflow = 'hidden';
    }

    function closeSidebar() {
        if (!sidebar) return;
        sidebar.classList.remove('sidebar-open');
        sidebarOverlay.classList.remove('sidebar-overlay-open');
        document.body.style.overflow = '';
    }

    if (sidebarOpen) sidebarOpen.addEventListener('click', openSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // Close sidebar on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeSidebar();
    });

    // Close sidebar when a link inside it is clicked
    document.querySelectorAll('#sidebar .sidebar-link, #sidebar a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    // Scroll reveal animation
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal').forEach(el => {
        observer.observe(el);
    });

    // Add scroll-reveal class to elements dynamically
    const revealElements = document.querySelectorAll('section h2, section h1, .news-card, .activity-card');
    revealElements.forEach(el => {
        if (!el.classList.contains('scroll-reveal')) {
            el.classList.add('scroll-reveal');
            observer.observe(el);
        }
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offset = 80; // Navbar height
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Activity filter (for pages with filter buttons)
    const filterButtons = document.querySelectorAll('.filter-btn');
    if (filterButtons.length > 0) {
        filterButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const category = this.dataset.filter;
                const cards = document.querySelectorAll('.activity-card');

                filterButtons.forEach(b => {
                    b.classList.remove('bg-karang-500', 'text-white', 'border-karang-500');
                    b.classList.add('text-gray-600', 'border-gray-300');
                });

                this.classList.add('bg-karang-500', 'text-white', 'border-karang-500');
                this.classList.remove('text-gray-600', 'border-gray-300');

                cards.forEach(card => {
                    if (category === 'all' || card.dataset.category === category) {
                        card.style.display = 'block';
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1)';
                        }, 10);
                    } else {
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.8)';
                        setTimeout(() => {
                            card.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
    }

    // Form validation enhancement
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = form.querySelectorAll('[required]');
            let isValid = true;

            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    isValid = false;
                    field.classList.add('border-red-500', 'ring-2', 'ring-red-200');

                    // Remove error styling on input
                    field.addEventListener('input', function() {
                        this.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
                    }, { once: true });
                }
            });

            if (!isValid) {
                e.preventDefault();
            }
        });
    });

    // Lazy loading images
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    observer.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }

    // Back to top button (optional)
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.className = 'fixed bottom-8 right-8 w-12 h-12 bg-karang-500 text-white rounded-full shadow-lg flex items-center justify-center opacity-0 pointer-events-none transition-all duration-300 hover:bg-karang-600 hover:scale-110 z-50';
    backToTopBtn.setAttribute('aria-label', 'Kembali ke atas');
    document.body.appendChild(backToTopBtn);

    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            backToTopBtn.classList.remove('opacity-0', 'pointer-events-none');
            backToTopBtn.classList.add('opacity-100', 'pointer-events-auto');
        } else {
            backToTopBtn.classList.add('opacity-0', 'pointer-events-none');
            backToTopBtn.classList.remove('opacity-100', 'pointer-events-auto');
        }
    });

    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    console.log('🚀 Karang Taruna App Loaded Successfully');
});
