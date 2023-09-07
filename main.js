const FEE_HIVE = 0.5; // fee in HIVE

const SYMBOL = "HELIOS"; // symbol of the token

const ACCOUNT = "helios.accounts"; // account name of the token

const VOUCHER_ACCOUNT = "helios.voucher"; // account name of the voucher token

let FEE = 0;

let MARKET = {};

let USER = null;

let USER_BALANCE = {};

let REDEEMED_VOUCHER = null;

const DECIMAL = 1000;

const client = new dhive.Client(["https://hived.emre.sh"]);

const ssc = new SSC("https://api.hive-engine.com/rpc");

// Checking if the already exists

async function checkAccountName(username) {
  let isValid = isValidAccountName(username);

  if (isValid) {
    const ac = await client.database.call("lookup_account_names", [[username]]);

    return ac[0] === null ? true : false;
  } else {
    return false;
  }
}

// Creates a suggested password

function suggestPassword() {
  const array = new Uint32Array(10);

  window.crypto.getRandomValues(array);

  const key = "HELIOS000" + dhive.PrivateKey.fromSeed(array).toString();

  return key.substring(0, 25);
}

// create a 6 letter voucher which is unique with the current timestamp and starting with H

function suggestVoucher() {
  // current timestamp
  const array = new Uint32Array(10);

  window.crypto.getRandomValues(array);

  const key = dhive.PrivateKey.fromSeed(array).toString();

  return "H" + key.substring(10, 16).toUpperCase();
}

// Generates Aall Private Keys from username and password

function getPrivateKeys(username, password, roles) {
  const privKeys = {};

  roles.forEach((role) => {
    privKeys[role] = dhive.PrivateKey.fromLogin(
      username,
      password,
      role
    ).toString();

    privKeys[`${role}Pubkey`] = dhive.PrivateKey.from(privKeys[role])
      .createPublic()
      .toString();
  });

  return privKeys;
}

// get current fee

const getCurrentFee = async () => {
  const market = await ssc.findOne("market", "metrics", { symbol: SYMBOL });
  var tokenLastPrice = market.lastPrice;
  tokenLastPrice = parseFloat(tokenLastPrice) || 0.0;
  tokenLastPrice = tokenLastPrice.toFixed(3);
  tokenLastPrice = parseFloat(tokenLastPrice) || 0.0;

  var tokenLastDayPrice = market.lastDayPrice;
  tokenLastDayPrice = parseFloat(tokenLastDayPrice) || 0.0;
  tokenLastDayPrice = tokenLastDayPrice.toFixed(3);
  tokenLastDayPrice = parseFloat(tokenLastDayPrice) || 0.0;

  var avgPrice = (tokenLastPrice + tokenLastDayPrice) / 2;
  avgPrice = parseFloat(avgPrice) || 0.0;
  avgPrice = avgPrice.toFixed(3);
  avgPrice = parseFloat(avgPrice) || 0.0;

  var calcFee = 0.0;
  if (avgPrice > 0.0) {
    calcFee = FEE_HIVE / avgPrice;
    calcFee = Math.ceil(calcFee * DECIMAL) / DECIMAL;
  }

  // calculate average price with (lastDayPrice + lastPrice / 2)

  //const averagePrice = (parseFloat(market.lastDayPrice) + parseFloat(market.lastPrice)) / 2;

  // calculate fee

  //const fee = FEE_HIVE / averagePrice;

  // conver fee to 3 decimal places and ciel it

  //return Math.ceil(fee * 1000) / 1000;

  return calcFee;
};

// get market

const getMarket = async () => {
  const { data } = await axios.get(
    "https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=usd"
  );

  const market = await ssc.findOne("market", "metrics", { symbol: SYMBOL });

  const price = parseFloat(market.lastPrice);

  const hivePrice = parseFloat(data.hive.usd);

  // calculate price in USD

  const priceInUSD = price * hivePrice;

  return { price, priceInUSD };
};

// get user balance

const getUserBalance = async (account) => {
  let balance = 0;

  let balanceInUSD = 0;

  const token = await ssc.findOne("tokens", "balances", {
    account,
    symbol: SYMBOL,
  });

  if (token) balance = parseFloat(token.balance);

  if (MARKET.priceInUSD) {
    balanceInUSD = balance * MARKET.priceInUSD;
  }

  return { balance, balanceInUSD };
};

// document ready

$(document).ready(async function () {
  // remove unnessary parameters from url

  window.history.replaceState({}, document.title, "/" + "");

  let isAvail = false;

  // Check if the name is available

  $("#new-account").keyup(async function () {
    const notifyDiv = $("#username-feedback");

    notifyDiv.text("Checking...");

    if ($(this).val().length >= 3) {
      isAvail = await checkAccountName($(this).val());

      let message = isAvail
        ? '<span class="text-success">Username is available.</span> &nbsp;'
        : '<span class="text-danger">Username is not available.</span> &nbsp;';

      notifyDiv.html(message);
    } else {
      notifyDiv.text("Enter the username you want to create.");

      isAvail = false;
    }

    createButtonCheck();
  });

  function createButtonCheck() {
    if (isAvail && $("#password").val().length >= 8) {
      if (USER_BALANCE.balance >= FEE || REDEEMED_VOUCHER !== null) {
        $("#create").prop("disabled", false);

        return;
      }
    }

    $("#create").prop("disabled", true);
  }

  // Check if the password is valid

  $("#password").keyup(function () {
    const notifyDiv = $("#password-feedback");

    if ($(this).val().length >= 8) {
      notifyDiv.html(
        '<span class="text-success">Password is valid. Make sure to save this password.</span>'
      );
    } else {
      notifyDiv.text("Password must be at least 8 characters.");
    }

    createButtonCheck();
  });

  // Suggest a password

  $("#password").val(suggestPassword());

  // refresh password

  $("#genpass").click(function () {
    let notifyDiv = $("#password-feedback");

    notifyDiv.html(
      '<span class="text-success">Random Generated Password</span>'
    );

    $("#password").val(suggestPassword());

    hackerEffect($("#password"), "input");
  });

  USER = localStorage.getItem("user");

  if (USER) $("#username").val(USER);

  async function update() {
    // update price

    MARKET = await getMarket();

    $("#price").text(MARKET.price.toFixed(5) + " HIVE");

    $("#priceInUSD").text("$" + MARKET.priceInUSD.toFixed(5));

    // update fee

    FEE = await getCurrentFee();
    console.log("FEE : ", FEE);

    $("#fee").text(FEE + " " + SYMBOL);

    $("#feeInHive").text("~ " + FEE_HIVE + " HIVE");

    $("#create-voucher").prop("disabled", true);

    // update user balance

    if (USER) {
      USER_BALANCE = await getUserBalance(USER);

      $("#balance").text(USER_BALANCE.balance.toFixed(3) + " " + SYMBOL);

      $("#balanceInUSD").text("~ $" + USER_BALANCE.balanceInUSD.toFixed(3));

      if (USER_BALANCE.balance >= FEE) {
        $("#create-voucher").prop("disabled", false);
      }

      if (!isCreationPending) createButtonCheck();
    }

    // update every 20 seconds

    setTimeout(update, 20000);
  }

  // load user balance

  $("#load-balance").click(async function () {
    $(this).prop("disabled", true);

    USER = $("#username").val();

    localStorage.setItem("user", USER);

    await update();

    $(this).prop("disabled", false);
  });

  update();

  let text;

  let isCreationPending = false;


  // create voucher
  $("#create-voucher").click(async function () {
    // disable button

    $("#new-voucher-name").val(`Gift by @${USER}!`);

    const cancelBtn = $("#cancel-voucher").html();
    
    $(this).prop("disabled", true);

    await update();

    $("#new-voucher-modal").modal("show");

    $("#new-voucher-fee").text(FEE + " " + SYMBOL);

    const newVoucher = suggestVoucher();
    $("#new-voucher").val(newVoucher);

    hackerEffect($("#new-voucher"), "input");

    $("#new-voucher-modal").on("hidden.bs.modal", function () {
      $("#create-voucher").prop("disabled", false);
      $("#new-voucher-feedback").html("");
      $("#unlock-voucher").prop("disabled", false);
      $("#cancel-voucher").html(cancelBtn);
      $("#cancel-voucher").removeClass("btn-success");
      $("#cancel-voucher").addClass("btn-secondary");

      $("#new-voucher-name").val(`Gift by @${USER}!!`);
    });

  });

  // unlock voucher
  $("#unlock-voucher").click(async function () {
    // disable button
    $(this).prop("disabled", true);

    const voucher = $("#new-voucher").val();
    const voucherName = $("#new-voucher-name").val();

    const data = {
      voucher_name: voucherName ? voucherName : `ACCOUNT VOUCHER`,
      voucher_key: voucher,
    }

    // encrypt voucher through hive keychain
    const keychain = window.hive_keychain;
    const notifyDiv = $("#new-voucher-feedback");

    if (!keychain) {
      $("#unlock-voucher").prop("disabled", false);

      notifyDiv.html(
        '<span class="text-danger">Hive Keychain is not installed.</span>'
      );

      return;
    }

    notifyDiv.html(
      '<span class="text-info">Verify & Transfer through Hive Keychain...</span>'
    );

    keychain.requestEncodeMessage(
      USER,
      VOUCHER_ACCOUNT,
      "#" + JSON.stringify(data),
      "Memo",
      (response) => {
        console.log(response);

        if (!response.success) {
          $("#unlock-voucher").prop("disabled", false);

          notifyDiv.html(
            '<span class="text-danger">Failed to encode voucher.</span>'
          );

          return;
        }

        const encodedVoucher = response.result;

        let op = JSON.stringify({
          contractName: "tokens",

          contractAction: "transfer",

          contractPayload: {
            symbol: "HELIOS",

            to: VOUCHER_ACCOUNT,

            quantity: FEE.toFixed(3),

            memo: encodedVoucher,
          },
        });

        notifyDiv.html('<span class="text-info">Now Transferring...</span>');

        // transfer voucher to account
        keychain.requestCustomJson(
          USER,
          "ssc-mainnet-hive",
          "Active",
          op,

          "Create Voucher by Burning HELIOS",

          async function (response) {
            console.log(response);

            if (!response.success) {
              $("#unlock-voucher").prop("disabled", false);

              notifyDiv.html(
                '<span class="text-danger">Failed to transfer.</span>'
              );

              return;
            }

            notifyDiv.html(
              `
              <div class="d-flex flex-column">
              <span class="text-success" style="font-size:1.1em; font-color:#198745">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
              </svg>&nbsp;
              Voucher created successfully! You can share the voucher and It can be used to create a Hive account for free! A Receipt will be sent to your Hive account too.</span>
              <span class="text-warning mt-2" style="font-size:1.1em">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>&nbsp;
              The Voucher is only valid for 90 Days!</span>
              </div>
              
              `
            );

            $("#cancel-voucher").removeClass("btn-secondary");
            $("#cancel-voucher").addClass("btn-success");

            $("#cancel-voucher").html(`
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16">
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
            </svg>&nbsp;
            Okay
            `);
            
          });
      });
      
  });

  const clipboardTimeout = (el) => {
    el.html(`
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="#FEC354" class="bi bi-clipboard-check" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>
        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>
        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>
      </svg>
    `);

    setTimeout(() => {
      el.html(`
        <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        fill="#FEC354"
        class="bi bi-clipboard"
        viewBox="0 0 16 16"
      >
        <path
          d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"
        />

        <path
          d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"
        />
      </svg>
    `);
  }, 3000);
};

  // copy voucher

  $("#copy-voucher").click(function () {
    const voucher = $("#new-voucher").val();

    navigator.clipboard.writeText(voucher);

    clipboardTimeout($("#copy-voucher"));

    
  });

  // copy voucher name
  $("#copy-voucher-name").click(function () {
    const voucherName = $("#new-voucher-name").val();

    navigator.clipboard.writeText(voucherName);

    clipboardTimeout($("#copy-voucher-name"));
  });



  // redeem voucher
  $("#redeem-voucher").click(async function () {
    // disable button

    $(this).prop("disabled", true);

    $("#voucher").val("");

    $("#redeem-voucher-modal").modal("show");

    $("#redeem-voucher-modal").on("hidden.bs.modal", function () {
      $("#redeem-voucher").prop("disabled", false);
      $("#redeem-voucher-feedback").html("");
      $("#redeem-account").prop("disabled", false);
    });

  });


  // redeem account
  $("#redeem-account").click(async function () {
    // disable button

    $(this).prop("disabled", true);

    const voucher = $("#voucher").val();

    // send verification request to helios api

    const response = await axios.get(`http://localhost:5000/voucher/verify/${voucher}`, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000
    });

    const res = response.data;

    // if voucher is already used
    if (res.isUsed === true) {
      $("#redeem-account").prop("disabled", false);

      $("#redeem-voucher-feedback").html(
        `<span class="text-warning mt-2" style="font-size:1.1em">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>&nbsp;
        Voucher is already used or expired!</span>`
      );

      return;
    }

    // if voucher is invalid or results are not successfull
    if (res.isVoucherValid !== true || res.success !== true) {
      $("#redeem-account").prop("disabled", false);

      $("#redeem-voucher-feedback").html(
        `<span class="text-warning mt-2" style="font-size:1.1em">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-exclamation-circle" viewBox="0 0 16 16">
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
          <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
        </svg>&nbsp;
        Invalid Voucher code!</span>`
      );

      return;
    }

    // if voucher is valid

    // strikethrough fee
    $("#fee").html(`<del>${FEE} ${SYMBOL}</del>`);
    $("#feeInHive").html(`<del>~ ${FEE_HIVE} HIVE</del>`);

    $("#user_load_div").html(`
    <div class="d-flex align-items-center gap-3 mb-2 flex-wrap">
      <div class="d-flex align-items-center">
        <button
          type="button"
          class="btn btn-warning rounded-pill p-0 ps-3 pe-3"
        >
          <span class="h4" style="font-weight: bold !important;">${res.data.voucherName}</span>
        </button>
      </div>

      <div class="d-flex align-items-center">
        <button
          type="button"
          class="btn btn-warning rounded-pill p-0 ps-3 pe-3"
          style="font-weight: bold"
        >
          <span class="h4" style="font-weight: bold !important;">${res.data.voucherKey}</span>
        </button>
      </div>
    </div>
    `);

    $("#info_sec_div").html(`
    <div class="d-flex">
      <span class="text-success" style="font-size:1.1em; font-color:#198745">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-check-circle" viewBox="0 0 16 16">
        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
        <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
      </svg>&nbsp;
      Voucher has been verified. You can now create a free accont!</span>
    </div>`);

    REDEEMED_VOUCHER = res.data.voucherKey;

    $("#new-account").keyup();

    $("#redeem-voucher-modal").modal("hide");
  });


  // create account

  $("#create").click(async function () {
    // disable button

    $(this).prop("disabled", true);

    $("#new-account").keyup();

    await update();

    if ($("#create").prop("disabled") == true) return;

    isCreationPending = true;

    let notifyDiv = $("#create-feedback");

    // get username and password

    const username = $("#new-account").val();

    const password = $("#password").val();

    const roles = ["owner", "active", "posting", "memo"];

    // generate keys

    const keys = getPrivateKeys(username, password, roles);

    // if the creation is via voucher
    if (REDEEMED_VOUCHER !== null) {
      await createAccViaVoucher(username, password, keys, notifyDiv);

      return;
    }

    // create account with hive keychain

    const message = JSON.stringify({
      account_name: username,

      password,
    });

    const keychain = window.hive_keychain;

    if (!keychain) {
      isCreationPending = false;

      $("#create").prop("disabled", false);

      notifyDiv.html(
        '<span class="text-danger">Hive Keychain is not installed.</span>'
      );

      return;
    }

    notifyDiv.html(
      '<span class="text-info">Verify & Transfer through Hive Keychain...</span>'
    );

    keychain.requestEncodeMessage(
      USER,
      ACCOUNT,
      "#" + message,
      "Memo",
      (response) => {
        console.log(response);

        if (!response.success) {
          isCreationPending = false;

          $("#create").prop("disabled", false);

          notifyDiv.html(
            '<span class="text-danger">Failed to encode message.</span>'
          );

          return;
        }

        const encodedMessage = response.result;

        let op = JSON.stringify({
          contractName: "tokens",

          contractAction: "transfer",

          contractPayload: {
            symbol: "HELIOS",

            to: ACCOUNT,

            quantity: FEE.toFixed(3),

            memo: encodedMessage,
          },
        });

        notifyDiv.html('<span class="text-info">Now Transferring...</span>');

        // create account

        keychain.requestCustomJson(
          USER,
          "ssc-mainnet-hive",
          "Active",
          op,

          "Create Account by Burning HELIOS",

          async function (response) {
            console.log(response);

            if (!response.success) {
              isCreationPending = false;

              $("#create").prop("disabled", false);

              notifyDiv.html(
                '<span class="text-danger">Failed to transfer HELIOS.</span>'
              );

              return;
            }

            $("#new-username").text(username);

            $("#new-password").text(password);

            // add to view

            roles.forEach((key) => {
              $("#" + key).text(keys[key]);

              hackerEffect($("#" + key));
            });

            // show #keyscard and slide in from right

            $("#keyscard").removeClass("d-none");

            $("#keyscard").show();

            // notify

            notifyDiv.html(
              '<span class="text-success">Account creation requested successfully!</span>'
            );
          }
        );
      }
    );

    text = `Username: ${username}\n\n`;

    text += `Backup (Master Password): ${password}\n\n`;

    text += `Owner Key: ${keys.owner}\n\n`;

    text += `Active Key: ${keys.active}\n\n`;

    text += `Posting Key: ${keys.posting}\n\n`;

    text += `Memo Key: ${keys.memo}`;
  });

  const createAccViaVoucher = async (username, password, keys, notifyDiv) => {
    // add a spinner in a new bs modal
    const modal = `
    <div class="modal" data-bs-backdrop="static" tabindex="-1" id="create-account-modal">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content card">
          <div class="d-flex justify-content-center mt-3">
            <div class="spinner-border text-warning" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          </div>
          <div class="modal-body">
            <div class="d-flex justify-content-center mt-3">
              <span class="text-warning">Shifting Gears...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;

    $("body").append(modal);

    $("#create-account-modal").modal("show");

    notifyDiv.html(
      '<span class="text-info">Creating Account...</span>'
    );

    // send request to helios api with voucher key and account info
    const response = await axios.post(
      `http://localhost:5000/voucher/create`,
      {
        key: REDEEMED_VOUCHER,
        account: {
          username,
          password,
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 10000
      }
    );

    const res = response.data;

    console.log(res);

    // if request is failed
    if (res.success !== true || res.isCreated === false) {
      $("#create-account-modal").modal("hide");

      isCreationPending = false;

      $("#create").prop("disabled", false);

      let msg = "Failed to create account.";

      if (res.data.message) msg = res.message;

      notifyDiv.html(
        `<span class="text-danger">${msg}</span>`
      );

      return;
    }

    // if account is created
    $("#create-account-modal").modal("hide");

    $("#new-username").text(username);

    $("#new-password").text(password);

    // add to view

    const roles = ["owner", "active", "posting", "memo"];

    roles.forEach((key) => {
      $("#" + key).text(keys[key]);

      hackerEffect($("#" + key));
    });

    // show #keyscard and slide in from right

    $("#keyscard").removeClass("d-none");

    $("#keyscard").show();

    // notify

    notifyDiv.html(
      '<span class="text-success">Account creation requested successfully!</span>'
    );

    // text

    text = `Username: ${username}\n\n`;

    text += `Backup (Master Password): ${password}\n\n`;

    text += `Owner Key: ${keys.owner}\n\n`;

    text += `Active Key: ${keys.active}\n\n`;

    text += `Posting Key: ${keys.posting}\n\n`;

    text += `Memo Key: ${keys.memo}`;

    let key_info = $("#keys-info").text();

    key_info = key_info.replace("This new account's credentials will also be transferred to you via an encrypted memo.", "");
  
    $("#keys-info").text(key_info);
  }

  // copy text

  $("#copy").click(function () {
    const originalText = $(this).html();

    $("#copy").html(`

      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-clipboard-check" viewBox="0 0 16 16">

        <path fill-rule="evenodd" d="M10.854 7.146a.5.5 0 0 1 0 .708l-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7.5 9.793l2.646-2.647a.5.5 0 0 1 .708 0z"/>

        <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/>

        <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/>

      </svg>

      <span>Copied</span>

    `);

    navigator.clipboard.writeText(text);

    setTimeout(() => {
      $("#copy").html(originalText);
    }, 3000);
  });

  // download text

  $("#download").click(function () {
    const username = $("#new-account").val();

    const downtext = text + `\n\nAccount Created by HELIOS - acc.helios.surf`;

    const element = document.createElement("a");

    element.setAttribute(
      "href",
      "data:text/plain;charset=utf-8," + encodeURIComponent(downtext)
    );

    element.setAttribute("download", `KEYS - @${username.toUpperCase()}.txt`);

    element.style.display = "none";

    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  });

  // css effects

  const letters =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  function hackerEffect(element, type = "text") {
    let original = type == "text" ? element.text() : element.val();

    let iteration = 0;

    let interval = null;

    clearInterval(interval);

    interval = setInterval(() => {
      let text = type == "text" ? element.text() : element.val();

      const hackerText = text

        .split("")

        .map((letter, index) => {
          if (index < iteration) {
            return original[index];
          }

          return letters[Math.floor(Math.random() * 62)];
        })

        .join("");

      type == "text" ? element.text(hackerText) : element.val(hackerText);

      if (iteration >= original.length) {
        clearInterval(interval);
      }

      iteration += 1 / 3;
    }, 30);
  }

  hackerEffect($("#password"), "input");
});

// if the account name is valid

function isValidAccountName(value) {
  if (!value) {
    // Account name should not be empty.

    return false;
  }

  if (typeof value !== "string") {
    // Account name should be a string.

    return false;
  }

  let len = value.length;

  if (len < 3) {
    // Account name should be longer.

    return false;
  }

  if (len > 16) {
    // Account name should be shorter.

    return false;
  }

  const ref = value.split(".");

  len = ref.length;

  for (let i = 0; i < len; i += 1) {
    const label = ref[i];

    if (label.length < 3) {
      // Each account segment be longer

      return false;
    }

    if (!/^[a-z]/.test(label)) {
      // Each account segment should start with a letter.

      return false;
    }

    if (!/^[a-z0-9-]*$/.test(label)) {
      // Each account segment have only letters, digits, or dashes.

      return false;
    }

    if (/--/.test(label)) {
      // Each account segment have only one dash in a row.

      return false;
    }

    if (!/[a-z0-9]$/.test(label)) {
      // Each account segment end with a letter or digit.

      return false;
    }
  }

  return true;
}
