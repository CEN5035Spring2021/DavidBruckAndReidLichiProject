FAU class CEN5035, Spring 2021, David Bruck's team project: **Secure Group Messenger**



Public project tracking:
[CEN5035Spring2021DavidBruckProject - Pivotal Tracker](https://www.pivotaltracker.com/n/projects/2488115)



The code is licensed under BSD 2-clause (simplified) license. See full license in file [LICENSE](LICENSE).

**&copy; Copyright David Bruck's group for FAU class CEN5035 Spring 2021.  
All rights reserved.**

### Localhost Setup

###### Prerequisites:

* Only use 64-bit Windows 10, Windows Server 2016, or Windows Server 2019. If you want to use the Docker version of the Azure Cosmos DB emulator, only the Pro version of Windows 10 Pro is supported.
* Ensure no other applications are using any of the following ports before running the Azure Cosmos DB emulator, running any tests, or running the application stack:
  1. 5000
  2. 5051
  3. 7071
  4. 8081
  5. 8088
  6. 8900 through 8902
  7. 10250 through 10256
  8. 10350
* Install Node.js LTS version 14.x:  
  [Node.js](https://nodejs.org/en/)
* Install Git for Windows:  
  [Git - Downloading Package (git-scm.com)](https://git-scm.com/download/win)
* Install Azure Functions Core Tools, v3 for Windows 64-bit:  
  [Azure/azure-functions-core-tools: Command line tools for Azure Functions (github.com)](https://github.com/Azure/azure-functions-core-tools#installing)
* Install .NET 5.0 SDK:  
  [Download .NET 5.0 (Linux, macOS, and Windows) (microsoft.com)](https://dotnet.microsoft.com/download/dotnet/5.0)
* Install Microsoft.Azure.SignalR.Emulator by running the follow command as the user which will be running the app:  
  ```shell
  dotnet tool install --global Microsoft.Azure.SignalR.Emulator --version 1.0.0-preview1-10723
  ```  
  [NuGet Gallery | Microsoft.Azure.SignalR.Emulator 1.0.0-preview1-10723](https://www.nuget.org/packages/Microsoft.Azure.SignalR.Emulator)
* Install Azure Cosmos DB emulator. Options provided for Docker or installing to Windows.
  * Docker installation of Azure Cosmos DB emulator:
    * Prerequisites:
      * Requires the Pro version of Windows 10.
      * Requires a computer with hardware virtualization support enabled.
      * Enable Windows features for Hyper-V and Windows Containers.
      * Install Docker Desktop on Windows:  
        [Install Docker Desktop on Windows | Docker Documentation](https://docs.docker.com/docker-for-windows/install/)
      * Configure Docker Desktop to use Windows Containers.
    * Run the command to start Azure Cosmos DB Docker container:  
      ```shell
      powershell docker run --name azure-cosmosdb-emulator --rm --memory 2GB -v $env:LOCALAPPDATA\CosmosDB-Emulator:C:\CosmosDB.Emulator\bind-mount -p 8081:8081 -p 8900:8900 -p 8901:8901 -p 8902:8902 -p 10250:10250 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 -p 10255:10255 -p 10256:10256 -p 10350:10350 -it mcr.microsoft.com/cosmosdb/windows/azure-cosmos-emulator
      ```  
      **Note:** the above command has to be run again if you restart your computer or the Docker container terminates for any other reason. As written, you need to leave the shell open. For later commands, open a new shell.
    * Install the self-signed SSL certificates the emulator creates. Run the command as administrator:  
      ```shell
      powershell.exe -executionpolicy bypass C:\Users\bruck\AppData\Local\CosmosDB-Emulator\importcert.ps1
      ```
  * Or, instead of Docker, follow the instructions to install the Azure Cosmos DB emulator to Windows:  
    [Install and develop locally with Azure Cosmos DB Emulator | Microsoft Docs](https://docs.microsoft.com/en-us/azure/cosmos-db/local-emulator?tabs=cli%2Cssl-netstd21#install-the-emulator)

###### Download the source and install Node Package Manager, or NPM, packages:

* Download this Git repository with command:  
  ```shell
  git clone https://github.com/CEN5035Spring2021/DavidBruckProject.git
  ```
* Install NPM packages via commands:  
  ```shell
  cd DavidBruckProject/azure-functions
  npm i
  cd ../dev-smtp-server
  npm i
  cd ../svelte-app
  npm i
  cd ../svelte-app-tests
  npm i
  ```

###### Run Jest end-to-end integration tests:

Run command:  
```shell
cd DavidBruckProject/svelte-app-tests
npm test
```

**Note:** the production build one of the component servers, the one for Azure Functions, will prune development NPM packages after build. Therefore after each test run, they will need to be reinstalled via commands:  
```shell
cd ../azure-functions
npm i
```
And remember to switch back to the `/svelte-app-tests` directory before trying to run `npm test` again.

**Note:** if a failure occurs during setting up the test harness (starting all the servers), it may not stop all the servers cleanly. It works fine if it fails during a test though, so this is usually a problem if a port is in use or maybe if Docker is unable to start. To cleanup afterwards, run the following commands:  
```shell
taskkill /F /IM node.exe
taskkill /F /IM asrs-emulator.exe
```

###### Run the servers for development:

* Start the development email server:
  * Open a new shell and run command:  
    ```shell
    cd DavidBruckProject/dev-smtp-server
    npm start
    ```
  * Keep this shell window handy while running. Its console update will be updated when a new email is received.
* Start the client application in development mode that has live updates when files change:
  * Open a new shell and run command:  
    ```shell
    cd DavidBruckProject/svelte-app
    npm run dev
    ```
* Start the server APIs (Azure Functions); also supports live updates when files change:
  * Open a new shell.
  * **Note:** although efforts were made to alleviate the error, Azure Functions may encounter an error talking to Azure Cosmos DB over HTTPS using a self-signed certificate. To completely prevent the possibility of error, set environment variable `NODE_TLS_REJECT_UNAUTHORIZED` to value `0`. The command to do this varies by which shell you are using:
    * If using Command Prompt, run command:  
      ```shell
      set NODE_TLS_REJECT_UNAUTHORIZED=0
      ```
    * If using Windows PowerShell, run command:  
      ```shell
      $env:NODE_TLS_REJECT_UNAUTHORIZED="0"
      ```
  * Regardless of whether you wanted to bypass SSL errors, in the same shell, run command:  
    ```shell
    cd DavidBruckProject/azure-functions
    npm start
    ```
* Start the Azure SignalR Service emulator:
  * Open a new shell and run command:  
    ```shell
    asrs-emulator.exe start -p 8088
    ```
* You should now be able to run the application in your browser at the following address:  
  [http://localhost:5000](http://localhost:5000)  
  **Note:** when receiving emails via the development email server, they will be quoted-printable encoded. Decode any links before navigating. For example:  
  ```
  http://localhost:5000/#organizationConfirmation=3Dbb1e8688-d85=
  e-4d8e-ba8f-935a0d5f8136
  ```  
  Decodes to the following link:  
  [http://localhost:5000/#organizationConfirmation=bb1e8688-d85e-4d8e-ba8f-935a0d5f8136](http://localhost:5000/#organizationConfirmation=bb1e8688-d85e-4d8e-ba8f-935a0d5f8136)  
  Online decoder available here: [Encode/Decode Quoted Printable - Webatic](https://www.webatic.com/quoted-printable-convertor)

###### Contributing to Git repository:

Git has a pre-commit already configured. You need to adapt any changes to make ESLint and Svelte validate happy without disabling any lint rules. You should also ensure all tests pass from `/svelte-app-tests` when you run `npm test` from there.  
If you get an error like `ESLint couldn't find the plugin "@typescript-eslint/eslint-plugin".`, then most likely you need to install NPM packages again in one of the folders, probably `/azure-functions` if you ran `npm test` because that does a production build that prunes development NPM packages.

Make your pull requests into `main` branch on GitHub, and fix any tests that fail in GitHub Actions.
