/*
 APKify Android builder.
 Requires on the BUILD SERVER:
 - JDK 17+
 - Android SDK
 - Android platform/build tools
 - Gradle 8.x

 The script creates a native Android WebView project, copies local web assets,
 writes AndroidManifest permissions, and runs Gradle assembleRelease.
*/
const fs=require("fs"),path=require("path"),{execFileSync}=require("child_process");
const {projects}=(()=>{const f=path.join(__dirname,"..","data","projects.json");return {projects:JSON.parse(fs.readFileSync(f,"utf8"))}})();
const id=process.argv[2], p=projects[id];
if(!p) process.exit(2);

const root=path.join(__dirname,"..","builds",id);
const app=root+"/app/src/main";
const javaDir=app+"/java/"+p.packageName.replace(/\./g,"/");
const assets=app+"/assets/web";
fs.mkdirSync(javaDir,{recursive:true});fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(app+"/res/values",{recursive:true});

function perm(x){return `    <uses-permission android:name="android.permission.${x}"/>`;}
const manifestPerms=p.permissions.map(perm).join("\n");

fs.writeFileSync(root+"/settings.gradle",`pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories{google();mavenCentral()} }\nrootProject.name='APKifyBuild'\ninclude ':app'\n`);
fs.writeFileSync(root+"/build.gradle",`plugins { id 'com.android.application' version '8.7.3' apply false }\n`);
fs.writeFileSync(root+"/app/build.gradle",`plugins { id 'com.android.application' }\n\nandroid { namespace '${p.packageName}'; compileSdk 35\n defaultConfig { applicationId '${p.packageName}'; minSdk 23; targetSdk 35; versionCode 1; versionName '${p.version}' }\n}\n`);
fs.writeFileSync(app+"/res/values/strings.xml",`<resources><string name="app_name">${p.name.replace(/&/g,"&amp;")}</string></resources>`);

let content;
if(p.sourceType==="link"){
  content=`<!doctype html><html><body style="font-family:sans-serif"><script>location.replace(${JSON.stringify(p.sourceValue)})</script><p>Opening website…</p></body></html>`;
}else if(p.sourceFile){
  const ext=path.extname(p.sourceFile).toLowerCase();
  if(ext===".zip"){
    try{execFileSync("unzip",["-o",p.sourceFile,"-d",assets],{stdio:"ignore"})}catch(e){fail("ZIP extraction failed. Install unzip.")}
  }else{
    fs.copyFileSync(p.sourceFile,assets+"/index.html");
  }
}
if(content)fs.writeFileSync(assets+"/index.html",content);
if(p.sourceType==="html" && !fs.existsSync(assets+"/index.html")) fail("HTML source missing.");

fs.writeFileSync(javaDir+"/MainActivity.java",`package ${p.packageName};
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;
public class MainActivity extends Activity {
  public void onCreate(Bundle b){
    super.onCreate(b);
    WebView w=new WebView(this);
    w.setWebViewClient(new WebViewClient());
    WebSettings s=w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    setContentView(w);
    w.loadUrl("file:///android_asset/web/index.html");
  }
}`);
fs.writeFileSync(app+"/AndroidManifest.xml",`<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${manifestPerms}
<application android:theme="@style/AppTheme" android:label="@string/app_name" android:usesCleartextTraffic="true">
<activity android:name=".MainActivity" android:exported="true">
<intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter>
</activity></application></manifest>`);
fs.writeFileSync(app+"/res/values/styles.xml",`<resources><style name="AppTheme" parent="android:style/Theme.Material.Light.NoActionBar"><item name="android:fontFamily">sans</item><item name="android:colorAccent">#000000</item></style></resources>`);

try{
  execFileSync("./gradlew",["assembleRelease"],{cwd:root,stdio:"inherit"});
  const apk=path.join(root,"app/build/outputs/apk/release/app-release.apk");
  if(!fs.existsSync(apk)) fail("Gradle finished but APK was not found.");
  projects[id].status="done";projects[id].message="APK berhasil dibuat.";projects[id].apkPath=apk;projects[id].finishedAt=new Date().toISOString();
  fs.writeFileSync(path.join(__dirname,"..","data","projects.json"),JSON.stringify(projects,null,2));
}catch(e){fail("Gradle build gagal. Pastikan JDK, Android SDK, Gradle wrapper dan build tools tersedia.");}

function fail(msg){
  projects[id].status="error";projects[id].message=msg;
  fs.writeFileSync(path.join(__dirname,"..","data","projects.json"),JSON.stringify(projects,null,2));
  process.exit(1);
}
