const COOL_BLUE = '0, 115, 255'

const GIF_IDs = {
    racer_draw:             "1Hy0DRZTB_t9MSS_qg4ejoCzFrnNjN_uB",
    racer_draw_cropped:     "1d7rnWz3i_p6XckcTtlg-kv9ghHFLQcr4",
    cartpole:               "1cUWwA_Hp71pzx8S6JFJbS5KNrHJezXg2",
    cartpoleV2:             "1VZFPv41XRj29m9aDTnmZkgpi7ui97Zgw",
    cartpole_net_only:      "1qSB5l5fRaDpGI5nccgpL6ai7RYbSEa6o",
    cartpole_netV2_1:       "1VDFXK6NWYkHi3Ytlf4VN4ZW2GWn5U-we",
    cartpole_netV3:         "1WEIiHcPbwVCQKHWb1gmSvLYudVGa4F-4",
    digits_draw:            "1xGccUN7Jr0zzuCXP8E8xuW45fqLX5hlO",
    digits_draw_cropped:    "1XnlhfXDf2lXq2vbMVuBolbRuheEWJOUU",
}

const GDRIVE_LINK = "https://drive.google.com/uc?id="

window.addEventListener('load', function() {

    "use strict";

    let innerHTML = `
    <div id="wrapper" style="display: grid; grid-template-columns: repeat(2, 50%); column-gap: 10px; row-gap: 10px; align-items: center;">

        <div>
            <h1>Luuk's AI Projects</h1>
            <p>
                Welcome to the landing page for my portfolio!
            </p>
            <a href="https://www.github.com/obviouslyluuk/portfolio">GitHub</a>
        </div>

        <a href = "index.html?racer">
            <div class="project_name"><h3>Racer</h3></div>
            <img src="${GDRIVE_LINK+GIF_IDs.racer_draw_cropped}" alt="Racer">
        </a>
        <a href = "index.html?digits">
            <div class="project_name"><h3>Digits</h3></div>
            <img src="${GDRIVE_LINK+GIF_IDs.digits_draw_cropped}" alt="Digits">
        </a>
        <a href = "index.html?cartpole">
            <div class="project_name"><h3>Cartpole</h3></div>
            <img src="${GDRIVE_LINK+GIF_IDs.cartpole_netV3}" alt="Cartpole">
        </a>
    </div>
    `

    let style = `
    <style>
    a {
        position: relative;
    }
    img {
        max-height: 100%;
        max-width: 100%;
        display: block;
        border: solid white 5px;
        border-radius: 15px;        
    }
    .project_name {
        position: absolute;
        display: none;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
        color: white;
    }
    a:hover .project_name {
        display: grid;
    }
    a:hover img {
        opacity: .2;
    }
    </style>
    `

    document.getElementsByTagName("a").forEach(element => {
        element.addEventListener('mousemove', function() {
            this.getElementsByTagName("img")[0].style.opacity = .2
            this.getElementsByTagName("div")[0].style.display = 'grid'
        })
        element.addEventListener('mouseout', function() {

        })
    })

    document.getElementById("menu").style.display = 'none'

    document.body.style.color = 'white'
    document.body.style['align-content'] = 'normal'
    document.body.style.padding = '20px'
    document.body.insertAdjacentHTML('beforeend', innerHTML)
    document.body.insertAdjacentHTML('beforeend', style)

    window.resize()

})

window.resize = function() {
    document.getElementById("wrapper").style['max-height'] = `${document.body.offsetHeight}px`
    document.getElementById("wrapper").style['max-width'] = `${document.body.offsetHeight*1.5}px`
}

window.addEventListener('resize', function() {
    window.resize()
})