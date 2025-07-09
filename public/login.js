console.log("connected");
let btn = document.getElementById("submit");
let username = document.getElementById("username");
let password= document.getElementById("password");


async function send(){
  const username1=username.value;
  const password1 = password.value;
  let res1= await fetch("/login",{ 
     method:'POST',
   headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: username1, password: password1 }),
    credentials:"include"
  })

  if(res1.ok){
    const data = await res1.json();
    if(data.success){
      window.location.href = '/chapters';
    }
  } else {
    const errorText = await res1.text();
    alert(errorText);
  }
}




btn.addEventListener("click", async ()=>{
  await send();
} )