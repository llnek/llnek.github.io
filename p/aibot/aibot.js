/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //Original idea/code from `AI Techniques for Game Programming` by Mat Buckland.
  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  function scenes(Mojo){

    const {Sprites:_S,
           Scenes:_Z,
           FX:_F,
           Input:_I,
           Game:_G,
           v2:_V,
           math:_M,
           ute:_,is}=Mojo;
    const {Geo}=_S;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const GA=window[ "io/czlab/mcfud/algo/NEAT"]();
    const int=Math.floor;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"NEAT/Smart Bots",
        action: {name:"PlayGame"},
        clickSnd:"click.mp3",
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      NUM_INPUTS=10+1,
      NUM_OUTPUTS=2,
      NUM_ELITES=10,
      NumSecs= 25,
      NumTicks=2500,
      HALF_PI = Math.PI/2,
      QUAD_PI = Math.PI/4,
      PI2  = Math.PI*2,
      ROWS=20,
      COLS=20,
      MaxTurnRate = 0.2;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /*sensors to detect obstacles */
    ////////////////////////////////////////////////////////////////////////////
    function mkSensors(s){
      let c=[s.x,s.y];
      return [s.rotation - HALF_PI,
              s.rotation - QUAD_PI,
              s.rotation,
              s.rotation + QUAD_PI,
              s.rotation + HALF_PI].map((a,i)=>{
                return [c,_V.add(c, _V.mul([Math.cos(a),Math.sin(a)],s.g.diag))] });
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /*make sure we don't hit anything just after respawn */
    ////////////////////////////////////////////////////////////////////////////
    function respawn(s){
      let ok;
      while(1){
        _V.set(s, randX(), randY());
        ok=true;
        for(let o,i=0;i<_G.obstacles.length;++i){
          o=_G.obstacles[i];
          if(_S.hitTest(o,s)){ ok=false; break; }
        }
        if(ok) break;
      }
      return s;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function randPos(s){
      let g;
      switch(_.randInt2(0,3)){
        case 0: g=_G.grid[6][11];break;
        case 1: g=_G.grid[7][11];break;
        case 2: g=_G.grid[14][7];break;
        default: g=_G.grid[15][7];break;
      }
      _V.set(s,_M.ndiv(g.x1+g.x2,2), _M.ndiv(g.y1+g.y2,2));
      return s;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function syncHeading(s){
      _V.set(s.m5.heading,Math.cos(s.rotation), Math.sin(s.rotation));
      return s;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function mkBot(brain, scene){
      const s= _S.tint(_S.sprite("tank.png"),_S.SomeColors.grey);
      let ang=_.randInt2(0,360);
      _S.sizeXY(s,_.evenN(_G.tileW*0.9),_.evenN(_G.tileH*0.9));
      _S.centerAnchor(s);
      s.m5.heading={x:0,y:0};
      ang=0;
      let
        h2=s.height/2,
        w2=s.width/2,
        d=Math.sqrt(w2*w2+h2*h2);
      s.angle= ang;
      s.g.diag= d * 1.2;
      s.g.diagRatio= d/s.g.diag;
      syncHeading(randPos(s));
      _.inject(s.g,{
        collided:false,
        W2:w2,
        H2:h2,
        lTrack: 0,
        rTrack: 0,
        fitness: 0,
        mmap: MapMemory(),
        spinBonus: 0,
        collisionBonus: 0,
        nnet:brain,
        reset(){
          this.fitness = 0;
          s.angle= ang;
          syncHeading(randPos(s));
          this.mmap.reset();
          this.spinBonus = 0;
          this.collisionBonus = 0;
        },
        testSensors(input){
          this.collided = false;
          for(let res,w,ss=mkSensors(s),i=0;i<ss.length;++i){
            w=ss[i];
            res=UNDEF;
            for(let o,p,j=0;j<_G.obstacles.length;++j){
              o=_G.obstacles[j];
              p=Geo.bodyWrap(_S.toPolygon(o),o.x,o.y);
              res= Geo.hitTestLinePolygon(w[0],w[1],p);
              if(res[0]){ break; }
              res=UNDEF;
            }
            if(res && res[0]){
              _.assert(0<= res[1]&&res[1]<=1,"bad sensor result");
              if(res[1]< s.g.diagRatio){ this.collided=true; }
              //_.log("c========"+ res[1]);
              input.push(res[1]);
            }else{
              input.push(-1);
            }
            let v= this.mmap.ticksLingered(w[1][0],w[1][1]);
            //_.log("v===="+v);
            if(v==0){
              input.push(-1)
            }else if(v<10){
              input.push(0)
            }else if(v<20){
              input.push(0.2)
            }else if(v<30){
              input.push(0.4)
            }else if(v<50){
              input.push(0.6)
            }else if(v<80){
              input.push(0.8)
            }else{
              input.push(1)
            }
          }
          return input.push(this.collided?1:0) && input;
        },
        endOfRunCalc(){
          this.fitness = this.fitness + this.mmap.numCellsVisited();
        },
        update(){
          let rotForce,output = this.nnet.update(this.testSensors([]));
          this.lTrack = output[0];
          this.rTrack = output[1];
          rotForce = this.lTrack - this.rTrack;
          // clamp rotation
          rotForce = rotForce < -MaxTurnRate ? -MaxTurnRate : (rotForce > MaxTurnRate?MaxTurnRate : rotForce);
          s.rotation += rotForce;
          syncHeading(s);
          if(!this.collided){
            s.m5.speed = this.lTrack + this.rTrack;
            _V.add$(s, _V.mul(s.m5.heading, s.m5.speed));
          }
          let rotationTolerance = 0.03;
          if(-rotationTolerance < rotForce && rotForce < rotationTolerance){
            this.spinBonus += 1;
          }
          if(!this.collided)
			      this.collisionBonus += 1;
          else
            s.rotation += _.randSign()* _.rand()* QUAD_PI;

          s.x > _G.arena.x2? s.x=_G.arena.x2 : (s.x<_G.arena.x1? s.x=_G.arena.x1 : 0);
          s.y > _G.arena.y2? s.y=_G.arena.y2 : (s.y<_G.arena.y1? s.y=_G.arena.y1 : 0);

          this.mmap.update(s.x,s.y);
          //_.log("numcells=="+this.mmap.numCellsVisited());

          //debug show sensors
          if(0){
            mkSensors(s).forEach(p=>{
              scene.g.dbg.moveTo(p[0][0], p[0][1]);
              scene.g.dbg.lineTo(p[1][0], p[1][1]);
              scene.g.dbg.circle(p[1][0], p[1][1], 2);
              scene.g.dbg.stroke({width:1, color:_S.color("red")});
            });
            //_.log("colll==="+this.collided);
          }
          return true;
        }
      });
      return s;
    }

    const NumBots=50;
    let ticks;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function randX(){ return _.randInt2(_G.arena.x1,_G.arena.x2) }
    function randY(){ return _.randInt2(_G.arena.y1,_G.arena.y2) }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    function MapMemory(){
      let
        grid= _.clone(_G.grid),//JSON.parse(JSON.stringify(_G.grid)),
        bbox=_S.gridBBox(0,0,grid),
        {tileW,tileH}=_G, px= -1, py=-1;
      grid.forEach(r=>r.forEach(c=> c.visits=0));
      /////
      function toCell(x,y){
        let
          cy=_M.ndiv(y-bbox.y1,tileH),
          cx=_M.ndiv(x-bbox.x1,tileW);
        if(cy<0)
          cy=0;
        else if(cy>=grid.length) cy=grid.length-1;
        if(cx<0)
          cx=0;
        else if(cx>=grid[0].length) cx=grid[0].length-1;

        return grid[cy][cx];
      }
      return{
        update(x,y){
          if(x<bbox.x1 || x>bbox.x2 ||
             y<bbox.y1 || y>bbox.y2){
          }else{
            toCell(x,y).visits += 1
          }
        },
        ticksLingered(x,y){
          return (x<bbox.x1 || x>bbox.x2 ||
                  y<bbox.y1 || y>bbox.y2) ? 999 : toCell(x,y).visits
        },
        reset(){
          grid.forEach(r=> r.forEach(g=> g.visits=0 ))
        },
        numCellsVisited(){
          let total = 0;
          grid.forEach(r=> r.forEach(g=>{
            if(g.visits>0) total +=1
          }));
          return total;
        }
      }
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        let
          self=this,
          K=Mojo.getScaleFactor(),
          gaPop, splitPoints, numWeightsInNN;
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initBlocks(grid){
            let
              g= grid[0][0],
              b, out=[],
              tw=g.x2-g.x1,
              th=g.y2-g.y1,
              color="#737350";
            //square
            b= _S.uuid(_S.rect(5*tw,5*th,color) ,"o-square");
            g=grid[ROWS-6-3][COLS-6-3];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            // 2 rects
            b= _S.uuid(_S.rect(4*tw,8*th,color),"o-vrect");
            g=grid[2][3];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            //
            b= _S.uuid(_S.rect(6*tw,3*th,color) ,"o-hrect");
            g=grid[2][3];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            //iso-tri
            b= _S.uuid( _S.triangle(5*tw,4*th,0.5,color,color) ,"isotrig");
            g=grid[3][COLS-7];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            //2 tri
            b= _S.uuid( _S.triangle(5*tw,2*th,0,color,color) , "rangtri-up");
            g=grid[ROWS-6][0];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            //flipped
            b= _S.uuid( _S.triangle(5*tw,-2*th,0,color,color) , "rangtri-down");
            g=grid[ROWS-4][0];
            _V.set(b,g.x1,g.y1);
            out.push(self.insert(b));
            //
            return _G.obstacles=out;
          },
          initLevel(){
            let
              out={},
              g,gfx=_S.graphics(),
              grid=_S.gridXY([ROWS,COLS],0.75,0.75,out), g0= grid[0][0];
            _S.drawGridBox(out,1,"white",gfx);
            _S.drawGridLines(0,0,grid,1,{color:"grey",alpha:0.2},gfx);
            self.insert(gfx);
            this.initBlocks(grid);
            _.inject(_G,{
              arena:out,
              gen:1,
              grid,
              tileW: g0.x2-g0.x1,
              tileH: g0.y2-g0.y1
            });
            //////
            gaPop= new GA.NeatGA(NumBots, NUM_INPUTS, NUM_OUTPUTS);
            let vecBots= gaPop.createPhenotypes().map(b=> mkBot(b,self));
            _.assert(vecBots.length==NumBots, "Bad pop size");
            vecBots.forEach(s=> self.insert(s));
            this.dbg= self.insert(_S.graphics());
            ticks= 0;
            this.letThemRoam=()=> vecBots.forEach(v=> v.g.update());
            this.reGen=()=>{
              vecBots.forEach(v=> v.g.endOfRunCalc());
              gaPop.epoch(vecBots.map(v=> v.g.fitness));
              gaPop.createPhenotypes().forEach((b,i)=>{
                vecBots[i].g.nnet=b;
                vecBots[i].g.reset();
              });
              _G.gen+=1;
              ticks = 0;
              //best are up front
              for(let i=0;i<NUM_ELITES;++i){
                vecBots[i].tint=_S.BtnColors.magenta; }
            }
            return self.insert(_S.bboxFrame(out));
          },
          initHud(){
            if(1){
              let s = _S.scaleBy(_S.sprite("menu.png"), 0.6*K,0.6*K);
              s.anchor.x=1;
              s.m5.press=_S.btnPress(s, _S.BtnColors.green,"white","click.mp3",()=>{
                _Z.runEx("Splash", SplashCfg)
              });
              self.insert(_I.mkBtn( _V.set(s, Mojo.width,0)));
            }
            if(1){
              let s=_S.bmpText("0",UI_FONT,16*K);
              this.genMsg=self.insert(s);
              s=_S.bmpText("0","unscii",16*K);
              _S.tint(_S.centerAnchor(s),"yellow");
              _S.pinAbove(_G.arena,s,s.height*1.5);
              return this.timeMsg=self.insert(s);
            }
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        this.g.initLevel() && this.g.initHud();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
      },
      postUpdate(dt){
        this.g.genMsg.text=`Generation: ${_G.gen}`;
        this.g.dbg.clear();
        ++ticks;
        this.g.timeMsg.text= `Training ${NumBots} bots: ${int(100*ticks/NumTicks)}%`;
        if(++ticks<NumTicks){
          this.g.letThemRoam()
        }else{
          this.g.reGen()
        }
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["tank.png","menu.png","click.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);


